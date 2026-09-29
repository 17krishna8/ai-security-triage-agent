import { db } from "@/db";
import {
  organizations,
  users,
  findings,
  verdicts,
  humanOutcomes,
  fixOutcomes,
  evalFindings,
  memories,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { baseHeuristicCall, parseFindingText } from "@/lib/heuristics";
import { checkPoisoningSignal } from "@/lib/safeguards";
import type { Decision, Severity } from "@/lib/types";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

interface FindingSpec {
  source: string;
  cweType: string;
  title: string;
  description: string;
  evidence?: string;
  filePath?: string;
  rawPayload?: Record<string, unknown>;
}

interface HistoricalSpec {
  spec: FindingSpec;
  humanDecision: Decision;
  humanSeverity: Severity;
  reason: string;
  fixDescription?: string;
  fixResult?: "success" | "regression" | "partial";
}

interface EvalSpec {
  spec: FindingSpec;
  groundTruthDecision: Decision;
  groundTruthSeverity: Severity;
}

interface Category {
  key: string;
  historical: HistoricalSpec[];
  evalItems: EvalSpec[];
  pendingExtra: FindingSpec[];
}

const categories: Category[] = [
  {
    key: "hardcoded-creds-test-fixtures",
    historical: [
      {
        spec: {
          source: "sast",
          cweType: "CWE-798",
          title: "Hardcoded API key in tests/fixtures/auth.fixture.js",
          description: "Static analysis flagged a hardcoded string resembling an API key inside a test fixture file.",
          evidence: 'const API_KEY = "sk_test_51Fk3xxxxFAKE0000";',
          filePath: "tests/fixtures/auth.fixture.js",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Fixture uses a fake, non-functional throwaway key used only in unit tests; never deployed and not a real secret.",
        fixDescription: "No fix needed; optionally add a lint rule allow-listing tests/fixtures/** for secret scanners.",
        fixResult: "success",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-798",
          title: "Hardcoded OAuth secret in __tests__/fixtures/oauth_mock.py",
          description: "Secret scanner flagged an OAuth client secret constant inside a mocked test fixture.",
          evidence: 'OAUTH_CLIENT_SECRET = "mock-secret-not-real-000"',
          filePath: "__tests__/fixtures/oauth_mock.py",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Mock fixture value, confirmed non-functional against any real OAuth provider.",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-798",
          title: "Hardcoded Stripe test key in spec/fixtures/stripe_test_key.rb",
          description: "Scanner flagged a Stripe-looking key literal inside a Ruby spec fixture.",
          evidence: 'STRIPE_KEY = "sk_test_FAKEFAKEFAKE"',
          filePath: "spec/fixtures/stripe_test_key.rb",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Confirmed Stripe test-mode key intended for fixtures; Stripe test keys cannot move real funds.",
      },
    ],
    evalItems: [
      {
        spec: {
          source: "sast",
          cweType: "CWE-798",
          title: "Hardcoded secret in tests/fixtures/db_seed.sql",
          description: "Scanner flagged a password literal used to seed a local test database.",
          evidence: "INSERT INTO users (email, password) VALUES ('test@acme.com', 'FakePassw0rd!');",
          filePath: "tests/fixtures/db_seed.sql",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-798",
          title: "API token committed in spec/fixtures/mailgun_mock.json",
          description: "Scanner flagged a Mailgun-looking API token inside a JSON test fixture used by the mail-sending test suite.",
          evidence: '{"mailgun_api_key": "key-00000000000000000000000fake"}',
          filePath: "spec/fixtures/mailgun_mock.json",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
    ],
    pendingExtra: [
      {
        source: "sast",
        cweType: "CWE-798",
        title: "Hardcoded AWS key in tests/fixtures/s3_mock.py",
        description: "Scanner flagged an AWS access key literal inside a mocked S3 client fixture used only in the test suite.",
        evidence: 'AWS_ACCESS_KEY_ID = "AKIAFAKEFAKEFAKEFAKE"',
        filePath: "tests/fixtures/s3_mock.py",
      },
    ],
  },
  {
    key: "xss-behind-auth",
    historical: [
      {
        spec: {
          source: "sast",
          cweType: "CWE-79",
          title: "Reflected XSS in internal admin dashboard search box",
          description: "User-supplied `q` query parameter is reflected unescaped into the admin dashboard search results page.",
          evidence: "<div>Results for: <%= params[:q] %></div>",
          filePath: "app/admin/search.erb",
        },
        humanDecision: "true_positive",
        humanSeverity: "Medium",
        reason: "Internal admin dashboard is only reachable behind corporate SSO + VPN; still a real bug worth fixing but blast radius is limited to already-trusted staff, so Medium rather than High.",
        fixDescription: "Escape the reflected value with the templating engine's auto-escaping helper before deploying to admin routes.",
        fixResult: "success",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-79",
          title: "Reflected XSS in internal ops console filter field",
          description: "The `filter` parameter on the internal ops console is rendered without encoding.",
          evidence: "document.write('Filter: ' + getParam('filter'));",
          filePath: "internal-ops/console.js",
        },
        humanDecision: "true_positive",
        humanSeverity: "Medium",
        reason: "Same pattern as previous internal-tool XSS findings: real issue, but SSO+VPN gating keeps it out of High territory.",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-79",
          title: "Stored XSS in internal support-ticket notes field",
          description: "Support agent notes are rendered without sanitization in the internal admin ticket viewer.",
          evidence: "<div class='notes'>{{ticket.internal_notes | safe}}</div>",
          filePath: "admin/templates/ticket_detail.html",
        },
        humanDecision: "true_positive",
        humanSeverity: "Medium",
        reason: "Internal-only admin tool behind SSO; consistent with the team's established downgrade pattern for this class of finding.",
      },
    ],
    evalItems: [
      {
        spec: {
          source: "sast",
          cweType: "CWE-79",
          title: "Reflected XSS in admin analytics panel date-range field",
          description: "The `range` query parameter is reflected into the internal analytics admin panel without escaping.",
          evidence: "<span>Range: <%= params[:range] %></span>",
          filePath: "app/admin/analytics.erb",
        },
        groundTruthDecision: "true_positive",
        groundTruthSeverity: "Medium",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-79",
          title: "Reflected XSS in internal feature-flag admin tool",
          description: "The `flag` parameter is echoed unescaped in the internal feature-flag management tool, reachable only via SSO+VPN.",
          evidence: "<p>Editing flag: <%= params[:flag] %></p>",
          filePath: "app/admin/flags.erb",
        },
        groundTruthDecision: "true_positive",
        groundTruthSeverity: "Medium",
      },
    ],
    pendingExtra: [
      {
        source: "sast",
        cweType: "CWE-79",
        title: "Reflected XSS in internal billing admin export tool",
        description: "The `export_label` parameter is reflected without escaping in the internal billing admin tool, only reachable behind SSO+VPN.",
        evidence: "<h2>Export: <%= params[:export_label] %></h2>",
        filePath: "app/admin/billing_export.erb",
      },
    ],
  },
  {
    key: "dependency-devdep-only",
    historical: [
      {
        spec: {
          source: "dependency_scan",
          cweType: "CVE",
          title: "Prototype pollution in webpack-dev-server (devDependency)",
          description: "Dependency scan flagged CVSS 8.1 prototype pollution vulnerability in webpack-dev-server, listed only under devDependencies.",
          evidence: "package.json: \"devDependencies\": {\"webpack-dev-server\": \"3.11.0\"}",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "webpack-dev-server is a devDependency only used for local development; it is never bundled or shipped to the production artifact, so production exposure is nil.",
        fixDescription: "Upgrade opportunistically during the next dependency refresh; not urgent since it never reaches production.",
      },
      {
        spec: {
          source: "dependency_scan",
          cweType: "CVE",
          title: "ReDoS vulnerability in eslint-plugin-import (devDependency)",
          description: "Dependency scan flagged CVSS 7.5 ReDoS vulnerability in eslint-plugin-import, a lint-time-only devDependency.",
          evidence: "package.json: \"devDependencies\": {\"eslint-plugin-import\": \"2.25.2\"}",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Lint-only tooling dependency, executed solely in CI/dev, never included in the shipped bundle.",
      },
      {
        spec: {
          source: "dependency_scan",
          cweType: "CVE",
          title: "Arbitrary file write in jest-worker (devDependency)",
          description: "Dependency scan flagged CVSS 7.8 issue in jest-worker, used exclusively for running the test suite.",
          evidence: "package.json: \"devDependencies\": {\"jest-worker\": \"26.6.1\"}",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Test-runner-only dependency; not present in the production deployment artifact.",
      },
    ],
    evalItems: [
      {
        spec: {
          source: "dependency_scan",
          cweType: "CVE",
          title: "Command injection in storybook (devDependency)",
          description: "Dependency scan flagged CVSS 8.6 command injection vulnerability in storybook, listed under devDependencies for component docs.",
          evidence: "package.json: \"devDependencies\": {\"storybook\": \"6.5.9\"}",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
      {
        spec: {
          source: "dependency_scan",
          cweType: "CVE",
          title: "Path traversal in webpack-bundle-analyzer (devDependency)",
          description: "Dependency scan flagged CVSS 7.2 path traversal in webpack-bundle-analyzer, a build-analysis-only devDependency.",
          evidence: "package.json: \"devDependencies\": {\"webpack-bundle-analyzer\": \"4.5.0\"}",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
    ],
    pendingExtra: [
      {
        source: "dependency_scan",
        cweType: "CVE",
        title: "Regex DoS in babel-eslint (devDependency)",
        description: "Dependency scan flagged CVSS 7.4 regex denial-of-service issue in babel-eslint, used only during linting in CI.",
        evidence: "package.json: \"devDependencies\": {\"babel-eslint\": \"10.1.0\"}",
      },
    ],
  },
  {
    key: "csrf-bearer-token-api",
    historical: [
      {
        spec: {
          source: "sast",
          cweType: "CWE-352",
          title: "Missing CSRF token on POST /api/v2/orders",
          description: "Scanner flagged the order-creation endpoint for lacking a CSRF token on state-changing POST requests.",
          evidence: "POST /api/v2/orders requires header Authorization: Bearer <token>; no cookies are used for auth.",
          filePath: "api/v2/orders/route.ts",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Endpoint authenticates exclusively via an Authorization: Bearer header, which browsers never attach automatically. CSRF requires an ambient credential (cookies); there is none here, so cross-site forgery is not possible.",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-352",
          title: "Missing CSRF token on POST /api/v2/payment-methods",
          description: "Scanner flagged the payment-methods endpoint for missing anti-CSRF protection.",
          evidence: "POST /api/v2/payment-methods requires Authorization: Bearer <token>; no session cookie is set.",
          filePath: "api/v2/payment-methods/route.ts",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Same bearer-token-only auth pattern as prior CSRF findings on this API; not exploitable via CSRF.",
      },
    ],
    evalItems: [
      {
        spec: {
          source: "sast",
          cweType: "CWE-352",
          title: "Missing CSRF token on POST /api/v2/subscriptions/cancel",
          description: "Scanner flagged the subscription-cancellation endpoint for missing a CSRF token.",
          evidence: "POST /api/v2/subscriptions/cancel requires Authorization: Bearer <token>; cookie auth is not used.",
          filePath: "api/v2/subscriptions/cancel/route.ts",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
      {
        spec: {
          source: "sast",
          cweType: "CWE-352",
          title: "Missing CSRF token on POST /api/v2/invoices",
          description: "Scanner flagged the invoice-creation endpoint for missing anti-CSRF protection.",
          evidence: "POST /api/v2/invoices requires Authorization: Bearer <token> header; no cookies involved.",
          filePath: "api/v2/invoices/route.ts",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
    ],
    pendingExtra: [
      {
        source: "sast",
        cweType: "CWE-352",
        title: "Missing CSRF token on POST /api/v2/refunds",
        description: "Scanner flagged the refunds endpoint for missing a CSRF token on a state-changing POST request.",
        evidence: "POST /api/v2/refunds requires Authorization: Bearer <token>; no session cookies present.",
        filePath: "api/v2/refunds/route.ts",
      },
    ],
  },
  {
    key: "open-redirect-allowlisted",
    historical: [
      {
        spec: {
          source: "bug_bounty",
          cweType: "CWE-601",
          title: "Open redirect via /login?next= parameter",
          description: "Bug bounty researcher reports that the `next` parameter on /login can redirect to an arbitrary external domain.",
          evidence: "GET /login?next=https://evil.example.com redirects the browser to evil.example.com after login.",
          filePath: "app/login/route.ts",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Confirmed the redirect allow-list (added in commit a1b2c3d) already restricts `next` to relative paths and registered partner domains; the reported external domain is rejected in the current build. Report was against a stale deployment.",
      },
      {
        spec: {
          source: "bug_bounty",
          cweType: "CWE-601",
          title: "Open redirect via /logout?returnTo= parameter",
          description: "Bug bounty researcher reports arbitrary external redirect via the `returnTo` parameter on /logout.",
          evidence: "GET /logout?returnTo=https://phisher.example redirects externally.",
          filePath: "app/logout/route.ts",
        },
        humanDecision: "false_positive",
        humanSeverity: "Low",
        reason: "Same allow-list validation already covers /logout's returnTo parameter; verified against current production build, not reproducible.",
      },
    ],
    evalItems: [
      {
        spec: {
          source: "bug_bounty",
          cweType: "CWE-601",
          title: "Open redirect via /sso/callback?redirect_uri= parameter",
          description: "Researcher reports the SSO callback's redirect_uri can point to an external attacker-controlled domain.",
          evidence: "GET /sso/callback?redirect_uri=https://attacker.example is claimed to redirect externally.",
          filePath: "app/sso/callback/route.ts",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
      {
        spec: {
          source: "bug_bounty",
          cweType: "CWE-601",
          title: "Open redirect via /share?url= parameter",
          description: "Researcher reports the social-share endpoint's url parameter can redirect anywhere.",
          evidence: "GET /share?url=https://malicious.example is claimed to redirect externally.",
          filePath: "app/share/route.ts",
        },
        groundTruthDecision: "false_positive",
        groundTruthSeverity: "Low",
      },
    ],
    pendingExtra: [
      {
        source: "bug_bounty",
        cweType: "CWE-601",
        title: "Open redirect via /auth/continue?to= parameter",
        description: "Researcher reports the auth continuation endpoint's `to` parameter can redirect to an arbitrary external domain.",
        evidence: "GET /auth/continue?to=https://evil.example is claimed to redirect externally.",
        filePath: "app/auth/continue/route.ts",
      },
    ],
  },
];

const genuinePending: FindingSpec[] = [
  {
    source: "sast",
    cweType: "CWE-89",
    title: "SQL injection in /api/v1/search via raw query concatenation",
    description: "The search endpoint concatenates the raw `q` parameter directly into a SQL WHERE clause.",
    evidence: "query = \"SELECT * FROM products WHERE name LIKE '%\" + q + \"%'\";",
    filePath: "api/v1/search/route.ts",
  },
  {
    source: "sast",
    cweType: "CWE-89",
    title: "SQL injection in legacy /reports/export.php via order_by parameter",
    description: "The `order_by` parameter is interpolated directly into the ORDER BY clause of a raw SQL query.",
    evidence: "$sql = \"SELECT * FROM reports ORDER BY \" . $_GET['order_by'];",
    filePath: "reports/export.php",
  },
  {
    source: "sast",
    cweType: "CWE-611",
    title: "XXE in invoice XML import feature",
    description: "The invoice import endpoint parses uploaded XML with external entity resolution enabled.",
    evidence: "DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance(); // XXE not disabled",
    filePath: "billing/xml/InvoiceImporter.java",
  },
  {
    source: "sast",
    cweType: "CWE-502",
    title: "Insecure deserialization in session-restore feature",
    description: "User-controlled session blob is passed directly to a native deserializer on restore.",
    evidence: "obj = pickle.loads(request.cookies.get('session_blob'))",
    filePath: "auth/session_restore.py",
  },
  {
    source: "sast",
    cweType: "CWE-916",
    title: "Passwords hashed with unsalted MD5",
    description: "The user model hashes passwords with a single round of unsalted MD5 before storing them.",
    evidence: "password_hash = hashlib.md5(password.encode()).hexdigest()",
    filePath: "models/user.py",
  },
  {
    source: "sast",
    cweType: "CWE-22",
    title: "Path traversal in /files/download endpoint",
    description: "The `filename` parameter is passed directly to the filesystem read call without canonicalization.",
    evidence: "return send_file(os.path.join(UPLOAD_DIR, request.args['filename']))",
    filePath: "files/download/route.ts",
  },
  {
    source: "bug_bounty",
    cweType: "CWE-601",
    title: "Open redirect via new /partners/redirect?dest= endpoint (no allow-list yet)",
    description: "Researcher reports the newly-added partner redirect endpoint accepts any external destination with no validation implemented.",
    evidence: "GET /partners/redirect?dest=https://anything.example redirects unconditionally.",
    filePath: "app/partners/redirect/route.ts",
  },
];

async function seedOrg(params: {
  orgName: string;
  bankId: string;
  userNames: { name: string; email: string; role: string }[];
  useCategories: boolean;
}) {
  const [org] = await db
    .insert(organizations)
    .values({ name: params.orgName, memoryBankId: params.bankId })
    .returning();

  const orgUsers = [];
  for (const u of params.userNames) {
    const [row] = await db
      .insert(users)
      .values({ orgId: org.id, name: u.name, email: u.email, role: u.role })
      .returning();
    orgUsers.push(row);
  }
  const primaryReviewer = orgUsers[0];

  if (!params.useCategories) {
    return { org, users: orgUsers };
  }

  let dayOffset = 30;

  for (const category of categories) {
    for (const h of category.historical) {
      dayOffset -= 1;
      const createdAt = daysAgo(dayOffset);
      const [finding] = await db
        .insert(findings)
        .values({
          orgId: org.id,
          source: h.spec.source,
          cweType: h.spec.cweType,
          title: h.spec.title,
          description: h.spec.description,
          evidence: h.spec.evidence ?? null,
          filePath: h.spec.filePath ?? null,
          rawPayload: h.spec.rawPayload ?? null,
          status: "resolved",
          createdAt,
        })
        .returning();

      const parsed = parseFindingText(finding);
      const base = baseHeuristicCall(parsed);

      const [verdict] = await db
        .insert(verdicts)
        .values({
          findingId: finding.id,
          memoryEnabled: false,
          decision: base.decision,
          severity: base.severity,
          severityReasoning: base.severityReasoning,
          suggestedFix: base.suggestedFix,
          confidence: 0.62,
          decisionSource: "heuristic",
          requiresHumanSignoff: base.severity === "Critical" || base.severity === "High",
          memoriesRecalled: [],
          memoriesUsed: [],
          createdAt,
        })
        .returning();

      const outcome = base.decision === h.humanDecision && base.severity === h.humanSeverity ? "confirmed" : "overridden";

      await db.insert(humanOutcomes).values({
        findingId: finding.id,
        verdictId: verdict.id,
        reviewerId: primaryReviewer.id,
        finalDecision: h.humanDecision,
        finalSeverity: h.humanSeverity,
        outcome,
        overrideReason: h.reason,
        createdAt,
      });

      await db.insert(memories).values({
        orgId: org.id,
        findingId: finding.id,
        memoryType: outcome === "overridden" ? "override" : "verdict",
        cweType: parsed.cweType,
        summary: `${finding.title} — ${h.reason}`,
        content: {
          findingSummary: parsed.summary,
          cweType: parsed.cweType,
          agentVerdict: base.decision,
          humanVerdict: h.humanDecision,
          decision: h.humanDecision,
          severity: h.humanSeverity,
          fixDescription: h.fixDescription,
          outcome,
          reasoning: h.reason,
        },
        weight: outcome === "overridden" ? "high" : "normal",
        sourceUserId: primaryReviewer.id,
        createdAt,
      });

      if (h.fixDescription) {
        await db.insert(fixOutcomes).values({
          findingId: finding.id,
          fixDescription: h.fixDescription,
          result: h.fixResult ?? "success",
          notes: "Recorded during historical seed data generation.",
          createdAt,
        });
      }
    }

    for (const e of category.evalItems) {
      dayOffset = Math.max(1, dayOffset - 1);
      const [finding] = await db
        .insert(findings)
        .values({
          orgId: org.id,
          source: e.spec.source,
          cweType: e.spec.cweType,
          title: e.spec.title,
          description: e.spec.description,
          evidence: e.spec.evidence ?? null,
          filePath: e.spec.filePath ?? null,
          rawPayload: e.spec.rawPayload ?? null,
          status: "pending",
          createdAt: daysAgo(1),
        })
        .returning();

      await db.insert(evalFindings).values({
        orgId: org.id,
        findingId: finding.id,
        groundTruthDecision: e.groundTruthDecision,
        groundTruthSeverity: e.groundTruthSeverity,
      });
    }

    for (const p of category.pendingExtra) {
      await db.insert(findings).values({
        orgId: org.id,
        source: p.source,
        cweType: p.cweType,
        title: p.title,
        description: p.description,
        evidence: p.evidence ?? null,
        filePath: p.filePath ?? null,
        rawPayload: p.rawPayload ?? null,
        status: "pending",
        createdAt: daysAgo(0),
      });
    }
  }

  for (const p of genuinePending) {
    await db.insert(findings).values({
      orgId: org.id,
      source: p.source,
      cweType: p.cweType,
      title: p.title,
      description: p.description,
      evidence: p.evidence ?? null,
      filePath: p.filePath ?? null,
      rawPayload: p.rawPayload ?? null,
      status: "pending",
      createdAt: daysAgo(0),
    });
  }

  return { org, users: orgUsers };
}

async function seedPoisoningScenario(orgId: string, mallory: { id: string; name: string }) {
  const unrelated: FindingSpec[] = [
    { source: "sast", cweType: "CWE-89", title: "SQLi reported in /api/v1/customers export", description: "Raw query concatenation in export path." },
    { source: "sast", cweType: "CWE-79", title: "Reflected XSS in public contact form", description: "Unescaped `message` field reflected on the public contact confirmation page." },
    { source: "sast", cweType: "CWE-798", title: "Hardcoded production DB password in config/production.yml", description: "Plaintext production database password committed to the repo." },
    { source: "dependency_scan", cweType: "CVE", title: "Critical RCE in production-facing image-processing library", description: "CVSS 9.8 remote code execution in a library used directly by the public upload endpoint." },
    { source: "bug_bounty", cweType: "CWE-601", title: "Open redirect on public /checkout/return endpoint", description: "Unrestricted external redirect confirmed reachable in production with no allow-list." },
    { source: "sast", cweType: "CWE-352", title: "Missing CSRF token on cookie-authenticated /account/delete", description: "Session-cookie-authenticated account deletion endpoint has no CSRF protection." },
  ];

  for (const spec of unrelated) {
    const createdAt = hoursAgo(Math.random() * 48 + 1);
    const [finding] = await db
      .insert(findings)
      .values({
        orgId,
        source: spec.source,
        cweType: spec.cweType,
        title: spec.title,
        description: spec.description,
        status: "resolved",
        createdAt,
      })
      .returning();

    const parsed = parseFindingText(finding);
    const base = baseHeuristicCall(parsed);

    const [verdict] = await db
      .insert(verdicts)
      .values({
        findingId: finding.id,
        memoryEnabled: false,
        decision: base.decision,
        severity: base.severity,
        severityReasoning: base.severityReasoning,
        suggestedFix: base.suggestedFix,
        confidence: 0.68,
        decisionSource: "heuristic",
        requiresHumanSignoff: base.severity === "Critical" || base.severity === "High",
        createdAt,
      })
      .returning();

    await db.insert(humanOutcomes).values({
      findingId: finding.id,
      verdictId: verdict.id,
      reviewerId: mallory.id,
      finalDecision: "false_positive",
      finalSeverity: "Low",
      outcome: "overridden",
      overrideReason: "Not exploitable in our environment, ignore.",
      createdAt,
    });

    await db.insert(memories).values({
      orgId,
      findingId: finding.id,
      memoryType: "override",
      cweType: parsed.cweType,
      summary: `${finding.title} — dismissed as false positive`,
      content: {
        findingSummary: parsed.summary,
        cweType: parsed.cweType,
        agentVerdict: base.decision,
        humanVerdict: "false_positive",
        decision: "false_positive",
        severity: "Low",
        outcome: "overridden",
        reasoning: "Not exploitable in our environment, ignore.",
      },
      weight: "high",
      sourceUserId: mallory.id,
      createdAt,
    });
  }

  await checkPoisoningSignal(orgId, mallory.id);
}

let seedPromise: Promise<boolean> | null = null;

export async function ensureSeeded(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const existing = await db.execute(sql`select count(*)::int as count from organizations`);
        const count = (existing.rows[0] as { count: number } | undefined)?.count ?? 0;
        if (count > 0) return false;

  const acme = await seedOrg({
    orgName: "Acme Corp",
    bankId: "org_acme",
    useCategories: true,
    userNames: [
      { name: "Alice Nguyen", email: "alice@acme-security.dev", role: "admin" },
      { name: "Bob Martinez", email: "bob@acme-security.dev", role: "analyst" },
      { name: "Mallory Chen", email: "mallory@acme-security.dev", role: "analyst" },
    ],
  });

  const mallory = acme.users.find((u) => u.name === "Mallory Chen")!;
  await seedPoisoningScenario(acme.org.id, mallory);

  await seedOrg({
    orgName: "Globex Security",
    bankId: "org_globex",
    useCategories: false,
    userNames: [{ name: "Priya Shah", email: "priya@globex-security.dev", role: "admin" }],
  });

  // A couple of standalone findings for Globex so its queue isn't empty,
  // deliberately with NO matching historical memories — this demonstrates
  // strict memory-bank isolation between orgs (Globex never sees Acme's
  // hard-won lessons about test fixtures, internal XSS, etc).
  const globexOrg = await db.select().from(organizations).where(sql`${organizations.name} = 'Globex Security'`);
  const globex = globexOrg[0];
  if (globex) {
    const globexFindings: FindingSpec[] = [
      {
        source: "sast",
        cweType: "CWE-798",
        title: "Hardcoded credential in tests/fixtures/legacy_login.spec.ts",
        description: "Scanner flagged a hardcoded password literal inside a Globex test fixture.",
        evidence: 'const password = "TestPass123!";',
        filePath: "tests/fixtures/legacy_login.spec.ts",
      },
      {
        source: "sast",
        cweType: "CWE-79",
        title: "Reflected XSS in Globex internal admin reporting tool",
        description: "The `report` parameter is reflected unescaped in the internal reporting admin tool.",
        evidence: "<div>Report: <%= params[:report] %></div>",
        filePath: "app/admin/reports.erb",
      },
      {
        source: "dependency_scan",
        cweType: "CVE",
        title: "Prototype pollution in webpack-dev-server (Globex devDependency)",
        description: "Dependency scan flagged the same devDependency-only CVE seen elsewhere in the industry.",
        evidence: "package.json: \"devDependencies\": {\"webpack-dev-server\": \"3.11.0\"}",
      },
    ];
    for (const spec of globexFindings) {
      await db.insert(findings).values({
        orgId: globex.id,
        source: spec.source,
        cweType: spec.cweType,
        title: spec.title,
        description: spec.description,
        evidence: spec.evidence ?? null,
        filePath: spec.filePath ?? null,
        status: "pending",
      });
    }
  }

        return true;
      } catch (err) {
        seedPromise = null;
        throw err;
      }
    })();
  }
  return seedPromise;
}
