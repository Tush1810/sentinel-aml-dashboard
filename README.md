# Sentinel AML Dashboard

## Demo

<video src="https://github.com/Tush1810/sentinel-aml-dashboard/raw/main/docs/sentinel-demo.mp4" controls width="100%"></video>

If the player does not load, [open the recording](docs/sentinel-demo.mp4) directly.

## 1. What the dashboard does

The dashboard is the analyst-facing screen for Sentinel. It reads the REST API of
`sentinel-aml-service` and shows four things: headline counts, the alert queue ordered by risk
score, the case workflow an analyst uses to decide on those alerts, and a customer's
transaction timeline.

It is a React single-page app built with Vite and TypeScript. It holds no state of its own
beyond the signed-in credentials, and it never talks to the database or to Kafka.

## 2. How it fits with the other two repositories

Sentinel is three repositories:

| Repository | Role |
|---|---|
| `sentinel-aml-service` | Ingestion, the alert queue API, case management, and the dashboard's backend. It owns the Postgres schema. |
| `sentinel-aml-engine` | Detection. It consumes Debezium change events for the `txn` table, evaluates the rule book, and writes alerts. |
| `sentinel-aml-dashboard` | This repository. |

Detection runs outside the request that creates a transaction, so posting a transaction returns
only a reference and a status. Alerts appear in the queue once the engine has evaluated the
transaction. The screen after posting reports that the transaction was accepted and nothing
about what it triggered.

## 3. Where each file lives

| Path | Contents |
|---|---|
| `src/api.ts` | Every call to the service, and the response types they return. |
| `src/App.tsx` | The summary tiles, the alert queue, the customer list, and the timeline. |
| `src/Cases.tsx` | The case list, the assign and dispose controls, and the audit trail. |
| `src/App.css` | All styling. There is no component library. |
| `vite.config.ts` | The dev-server proxy that forwards `/api` to the service. |

## 4. Prerequisites

You need Node 20 or later, and `sentinel-aml-service` running on port 8081. The dev server
proxies `/api` to `http://localhost:8081`, so the two run side by side with no CORS
configuration.

To see alerts appear, you also need `sentinel-aml-engine` running and its Debezium connector
registered. Without them the service still accepts transactions, but nothing evaluates them and
the queue stays as it was.

## 5. How to run it

To install the dependencies, run:

    npm install

To start the dev server on port 5173, run:

    npm run dev

To produce a production build in `dist/`, run:

    npm run build

To lint the source with oxlint, run:

    npm run lint

## 6. The case workflow

An alert is the engine saying a rule fired. A case is an analyst saying what they decided about
it. The Cases tab covers the whole lifecycle.

1. In the Alerts tab, tick one or more alerts, choose a priority, and select **Open case**. The
   alerts move to `IN_REVIEW`.
2. In the Cases tab, select the case and assign it to someone. The case moves to `IN_REVIEW`.
3. Choose a disposition and give a reason, then select **Dispose**. `FALSE_POSITIVE` and
   `CLEARED` close the case. `ESCALATED_TO_SAR` marks it for a Suspicious Activity Report.

Two rules the service enforces, which the UI surfaces as errors. A case covers exactly one
customer, so alerts spanning several customers are rejected. A disposed case cannot be decided
again, because that would overwrite the analyst on record.

Every transition is written to `audit_log` and shown in the case detail. A database trigger
rejects any update or delete on that table, so the trail cannot be edited after the fact.

## 7. Signing in

The service uses HTTP Basic auth with two accounts, `analyst` and `admin`. The dashboard asks
for those credentials and sends them on every request.

The two roles see different data. `AlertView` masks customer names on the server, so an analyst
sees `Ravi M.` and an admin sees `Ravi Menon` on the same alert. Masking happens in the service,
not here, so hiding a name in the browser is not what protects it.

## 8. Known limitations

- Credentials are held in component state. A page reload asks for them again.
- There is no way to create customers or accounts from the UI. Load them with the CSV
  ingestion endpoints on `sentinel-aml-service`.
- The alert queue fetches up to 100 alerts in one call and does not paginate.
- Nothing polls. To see alerts the engine raised after you loaded the page, reload it.
- There are no tests. `npm run build` type-checks the whole project, which is the only
  automated check.
