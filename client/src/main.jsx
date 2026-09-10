import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import "./styles.css";

const API = "http://localhost:5000/api";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN")}`;

async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(API + path, {
    ...options,
    headers
  });

  let body = null;

  try {
    body = response.status === 204 ? null : await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.message || "Request failed");
  }

  return body;
}

/* =========================================================
   AUTH
========================================================= */

function Auth({ onAuth }) {
  const [register, setRegister] = useState(false);
  const [role, setRole] = useState("client");

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    organization: "",
    accountantId: "",
    branch: ""
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const nav = useNavigate();

  const set = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value
    }));
  };

  const switchMode = () => {
    setRegister((previous) => !previous);
    setError("");

    setForm({
      email: "",
      password: "",
      name: "",
      organization: "",
      accountantId: "",
      branch: ""
    });

    setRole("client");
  };

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setError("");

    try {
      let payload;

      if (register) {
        if (role === "client") {
          payload = {
            role: "client",
            email: form.email,
            password: form.password
          };
        } else {
          payload = {
            role: "accountant",
            name: form.name,
            organization: form.organization,
            accountantId: form.accountantId,
            branch: form.branch,
            email: form.email,
            password: form.password
          };
        }
      } else {
        payload = {
          email: form.email,
          password: form.password
        };
      }

      const response = await api(
        `/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response?.token) {
        throw new Error("Authentication token was not returned by the server.");
      }

      const authenticatedUser =
        response?.user ||
        response?.data?.user ||
        response?.data ||
        null;

      if (!authenticatedUser) {
        throw new Error("User information was not returned by the server.");
      }

      if (!authenticatedUser.role) {
        throw new Error("User role was not returned by the server.");
      }

      const authData = {
        token: response.token,
        user: authenticatedUser
      };

      onAuth(authData);

      nav("/dashboard", {
        replace: true
      });
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <section>
        <div className="brand">
          ◈ Ledger<span>Agent</span>
        </div>

        <p className="eyebrow">
          ACCOUNTING OPERATIONS
        </p>

        <h1>
          {register
            ? "Create an account"
            : "Welcome back"}
        </h1>

        <form onSubmit={submit}>
          {register && (
            <label>
              Role

              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setError("");
                }}
                required
              >
                <option value="client">
                  Client
                </option>

                <option value="accountant">
                  Accountant
                </option>
              </select>
            </label>
          )}

          {register && role === "accountant" && (
            <>
              <label>
                Name

                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    set("name", e.target.value)
                  }
                />
              </label>

              <label>
                Organization

                <input
                  type="text"
                  required
                  value={form.organization}
                  onChange={(e) =>
                    set("organization", e.target.value)
                  }
                />
              </label>

              <label>
                Branch

                <input
                  type="text"
                  value={form.branch}
                  onChange={(e) =>
                    set("branch", e.target.value)
                  }
                />
              </label>

              <label>
                Accountant ID

                <input
                  type="text"
                  required
                  value={form.accountantId}
                  onChange={(e) =>
                    set("accountantId", e.target.value)
                  }
                />
              </label>
            </>
          )}

          <label>
            Email

            <input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                set("email", e.target.value)
              }
            />
          </label>

          <label>
            Password

            <input
              type="password"
              minLength="6"
              required
              value={form.password}
              onChange={(e) =>
                set("password", e.target.value)
              }
            />
          </label>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : register
              ? "Register"
              : "Login"}
          </button>
        </form>

        <p className="switch">
          {register
            ? "Already registered?"
            : "New to LedgerAgent?"}{" "}

          <button
            type="button"
            className="link-button"
            onClick={switchMode}
          >
            {register ? "Login" : "Register"}
          </button>
        </p>
      </section>

      <aside>
        <span>✦</span>

        <h2>
          Documents to decisions.
        </h2>

        <p>
          Secure AI-assisted accounting
          workflows for clients and accountants.
        </p>
      </aside>
    </main>
  );
}

/* =========================================================
   MAIN SHELL
========================================================= */

function Shell({ user, onLogout }) {
  const navigate = useNavigate();

  /*
    IMPORTANT:
    Prevent the application from crashing if the
    authenticated user is incomplete.
  */

  if (!user || !user.role) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  const role = String(user.role).toLowerCase();

  const displayName =
    user.name ||
    user.email ||
    "User";

  const initials =
    displayName
      .slice(0, 2)
      .toUpperCase();

  const nav =
    role === "accountant"
      ? [
          ["dashboard", "Dashboard"],
          ["documents", "Client documents"],
          ["review", "Review queue"],
          ["reports", "Reports"]
        ]
      : [
          ["dashboard", "Dashboard"],
          ["documents", "My documents"],
          ["upload", "Upload document"],
          ["reports", "Reports"],
          [
            "change-accountant",
            "Request change"
          ]
        ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    onLogout();

    navigate("/auth", {
      replace: true
    });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          ◈ Ledger<span>Agent</span>
        </div>

        <nav>
          {nav.map(([to, label]) => (
            <NavLink
              to={`/${to}`}
              key={to}
              end={to === "dashboard"}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="side-user">
          <b>
            {initials}
          </b>

          <span>
            {displayName}

            <small>
              {role}
            </small>
          </span>
        </div>

        <button
          type="button"
          className="logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">
              {role.toUpperCase()} WORKSPACE
            </p>

            <h1>
              LedgerAgent
            </h1>
          </div>

          <span className="profile">
            {initials}
          </span>
        </header>

        <Routes>
          <Route
            path="dashboard"
            element={
              <Dashboard user={user} />
            }
          />

          <Route
            path="documents"
            element={
              <Documents user={user} />
            }
          />

          <Route
            path="upload"
            element={
              role === "client"
                ? <Upload />
                : <Navigate
                    to="/dashboard"
                    replace
                  />
            }
          />

          <Route
            path="documents/:id"
            element={
              <Details user={user} />
            }
          />

          <Route
            path="review"
            element={
              role === "accountant"
                ? <Review />
                : <Navigate
                    to="/dashboard"
                    replace
                  />
            }
          />

          <Route
            path="reports"
            element={
              <Reports />
            }
          />

          <Route
            path="change-accountant"
            element={
              role === "client"
                ? <ChangeRequest />
                : <Navigate
                    to="/dashboard"
                    replace
                  />
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="dashboard"
                replace
              />
            }
          />
        </Routes>
      </section>
    </div>
  );
}

/* =========================================================
   CLIENT ASSIGNMENT
========================================================= */

function Assignment({ onDone }) {
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState("");
  const [accountants, setAccountants] = useState([]);
  const [accountantId, setAccountantId] =
    useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    api("/organizations")
      .then((data) => {
        if (active) {
          setOrgs(
            Array.isArray(data)
              ? data
              : []
          );
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!org) {
      setAccountants([]);
      return;
    }

    setError("");

    api(
      `/organizations/${encodeURIComponent(
        org
      )}/accountants`
    )
      .then((data) => {
        setAccountants(
          Array.isArray(data)
            ? data
            : []
        );
      })
      .catch((e) => {
        setAccountants([]);
        setError(e.message);
      });
  }, [org]);

  const save = async () => {
    if (!org || !accountantId) {
      setError(
        "Please select both organization and accountant."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api(
        "/client/assignment",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            organization: org,
            accountantId
          })
        }
      );

      if (data) {
        localStorage.setItem(
          "user",
          JSON.stringify(data.user || data)
        );
      }

      onDone(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel assignment">
      <h2>
        Select your organization and accountant
      </h2>

      <label>
        Organization

        <select
          value={org}
          onChange={(e) => {
            setOrg(e.target.value);
            setAccountantId("");
          }}
          required
        >
          <option value="">
            Choose organization
          </option>

          {orgs.map((x) => (
            <option
              value={x.name}
              key={x._id || x.name}
            >
              {x.name}
            </option>
          ))}
        </select>
      </label>

      {org && (
        <label>
          Accountant

          <select
            value={accountantId}
            onChange={(e) =>
              setAccountantId(
                e.target.value
              )
            }
            required
          >
            <option value="">
              Choose accountant
            </option>

            {accountants.map((x) => (
              <option
                value={x._id}
                key={x._id}
              >
                {x.name} —{" "}
                {x.branch ||
                  "Branch not specified"}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        disabled={
          !accountantId || loading
        }
        onClick={save}
      >
        {loading
          ? "Saving..."
          : "Save assignment"}
      </button>

      {error && (
        <p className="error">
          {error}
        </p>
      )}
    </section>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [current, setCurrent] =
    useState(user);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setError("");

    api("/dashboard")
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      });

    return () => {
      active = false;
    };
  }, [current]);

  if (error) {
    return (
      <>
        <PageTitle
          title="Dashboard"
          copy="Your LedgerAgent workspace."
        />

        <p className="error">
          {error}
        </p>
      </>
    );
  }

  if (!data) {
    return <Loading />;
  }

  if (
    user.role === "client" &&
    !data.assignment
  ) {
    return (
      <Assignment
        onDone={(response) => {
          const updatedUser =
            response?.user ||
            response;

          if (updatedUser) {
            localStorage.setItem(
              "user",
              JSON.stringify(updatedUser)
            );

            setCurrent(
              updatedUser
            );
          }

          setData(null);
        }}
      />
    );
  }

  const clientList =
    Array.isArray(data.clientList)
      ? data.clientList
      : [];

  const recent =
    Array.isArray(data.recent)
      ? data.recent
      : [];

  return (
    <>
      <div className="intro">
        <p className="eyebrow">
          OVERVIEW
        </p>

        <h2>
          {user.role === "client"
            ? "Your document status"
            : "Your practice overview"}
        </h2>

        {data.assignment && (
          <p>
            Organization:{" "}
            <b>
              {data.assignment.organization}
            </b>{" "}
            · Accountant:{" "}
            <b>
              {data.assignment.accountant?.name ||
                "Not assigned"}
            </b>{" "}
            (
            {data.assignment.accountant
              ?.branch ||
              "Branch not specified"}
            )
          </p>
        )}
      </div>

      <Metrics
        data={data}
        accountant={
          user.role === "accountant"
        }
      />

      {user.role === "accountant" && (
        <section className="panel">
          <h2>
            Assigned clients
          </h2>

          <table>
            <thead>
              <tr>
                <th>CLIENT</th>
                <th>ORGANIZATION</th>
                <th>DOCUMENTS</th>
                <th>PENDING</th>
              </tr>
            </thead>

            <tbody>
              {clientList.map((x) => (
                <tr
                  key={
                    x._id ||
                    x.id ||
                    x.email
                  }
                >
                  <td>
                    {x.name ||
                      x.email ||
                      "Unknown"}
                  </td>

                  <td>
                    {x.organization ||
                      "—"}
                  </td>

                  <td>
                    {x.documents || 0}
                  </td>

                  <td>
                    {x.pending || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!clientList.length && (
            <p className="empty">
              No clients assigned yet.
            </p>
          )}
        </section>
      )}

      <section className="panel">
        <h2>
          Recent documents
        </h2>

        <DocumentTable
          docs={recent}
          user={user}
        />

        {!recent.length && (
          <p className="empty">
            No documents uploaded yet.
          </p>
        )}
      </section>
    </>
  );
}

/* =========================================================
   METRICS
========================================================= */

function Metrics({
  data = {},
  accountant = false
}) {
  const metrics = accountant
    ? [
        ["Clients", data.clients],
        ["Total documents", data.total],
        ["Pending review", data.pending],
        ["Approved", data.approved],
        ["Rejected", data.rejected]
      ]
    : [
        ["Total documents", data.total],
        ["Pending", data.pending],
        ["Approved", data.approved],
        ["Rejected", data.rejected]
      ];

  return (
    <div className="metrics">
      {metrics.map(([label, value]) => (
        <article key={label}>
          <p>
            {label}
          </p>

          <strong>
            {value || 0}
          </strong>
        </article>
      ))}
    </div>
  );
}

/* =========================================================
   DOCUMENTS
========================================================= */

function Documents({ user }) {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] =
    useState(true);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data =
        await api("/documents");

      setDocs(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    if (
      !window.confirm(
        "Delete this document?"
      )
    ) {
      return;
    }

    try {
      await api(
        `/documents/${id}`,
        {
          method: "DELETE"
        }
      );

      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <PageTitle
        title={
          user.role === "client"
            ? "My documents"
            : "Client documents"
        }
        copy="Documents you are authorized to access."
      />

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      <section className="panel">
        {loading ? (
          <Loading />
        ) : (
          <>
            <DocumentTable
              docs={docs}
              user={user}
              onDelete={
                user.role === "client"
                  ? remove
                  : null
              }
            />

            {!docs.length && (
              <p className="empty">
                No documents uploaded yet.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

/* =========================================================
   DOCUMENT TABLE
========================================================= */

function DocumentTable({
  docs = [],
  user,
  onDelete
}) {
  const nav = useNavigate();

  return (
    <table>
      <thead>
        <tr>
          <th>
            DOCUMENT
          </th>

          {user.role === "accountant" && (
            <th>
              CLIENT
            </th>
          )}

          <th>
            UPLOADED
          </th>

          <th>
            OCR
          </th>

          <th>
            STATUS
          </th>

          <th></th>
        </tr>
      </thead>

      <tbody>
        {docs.map((d) => (
          <tr
            key={d._id}
            onClick={() =>
              nav(
                `/documents/${d._id}`
              )
            }
            style={{
              cursor: "pointer"
            }}
          >
            <td>
              <b>
                {d.originalName ||
                  d.invoiceNumber ||
                  "Unnamed document"}
              </b>

              <small>
                {d.vendor ||
                  "No vendor extracted"}
              </small>
            </td>

            {user.role === "accountant" && (
              <td>
                {d.client?.name ||
                  d.client?.email ||
                  "—"}
              </td>
            )}

            <td>
              {d.createdAt
                ? new Date(
                    d.createdAt
                  ).toLocaleDateString()
                : "—"}
            </td>

            <td>
              {d.ocrStatus ||
                "—"}
            </td>

            <td>
              <span
                className={`status ${
                  d.status || ""
                }`}
              >
                {d.status ||
                  "Pending"}
              </span>
            </td>

            <td>
              {onDelete && (
                <button
                  type="button"
                  className="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(d._id);
                  }}
                >
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =========================================================
   UPLOAD
========================================================= */

function Upload() {
  const [file, setFile] =
    useState(null);

  const [type, setType] =
    useState("Invoice");

  const [message, setMessage] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage(
        "Please select a document."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "documentType",
        type
      );

      const data =
        await api(
          "/documents/upload",
          {
            method: "POST",
            body: formData
          }
        );

      if (!data?._id) {
        throw new Error(
          "Document uploaded but no document ID was returned."
        );
      }

      nav(
        `/documents/${data._id}`
      );
    } catch (e) {
      setMessage(
        e.message ||
          "Upload failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Upload document"
        copy="Your assigned accountant will review the AI extraction."
      />

      <form
        className="upload-form"
        onSubmit={submit}
      >
        <label>
          Document type

          <select
            value={type}
            onChange={(e) =>
              setType(
                e.target.value
              )
            }
          >
            {[
              "Invoice",
              "Receipt",
              "Purchase document",
              "Sales document",
              "Statement"
            ].map((x) => (
              <option
                value={x}
                key={x}
              >
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="drop">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) =>
              setFile(
                e.target.files?.[0] ||
                  null
              )
            }
          />

          <span>
            ↑
          </span>

          <b>
            {file?.name ||
              "Choose a PDF, JPG or PNG"}
          </b>

          <small>
            Maximum 20 MB
          </small>
        </label>

        <button
          type="submit"
          disabled={!file || busy}
        >
          {busy
            ? "Processing OCR and AI…"
            : "Upload document"}
        </button>

        {message && (
          <p className="error">
            {message}
          </p>
        )}
      </form>
    </>
  );
}

/* =========================================================
   DOCUMENT DETAILS
========================================================= */

function Details({ user }) {
  const { id } =
    useParams();

  const [doc, setDoc] =
    useState(null);

  const [editing, setEditing] =
    useState(false);

  const [reason, setReason] =
    useState("");

  const [error, setError] =
    useState("");

  const nav = useNavigate();

  useEffect(() => {
    let active = true;

    api("/documents")
      .then((documents) => {
        if (!active) {
          return;
        }

        const found =
          Array.isArray(documents)
            ? documents.find(
                (x) =>
                  x._id === id
              )
            : null;

        if (!found) {
          setError(
            "Document not found."
          );
        }

        setDoc(found || null);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <>
        <PageTitle
          title="Document analysis"
          copy="Unable to load this document."
        />

        <p className="error">
          {error}
        </p>
      </>
    );
  }

  if (!doc) {
    return <Loading />;
  }

  const fields = [
    ["Vendor", "vendor"],
    ["Customer", "customer"],
    [
      "Invoice number",
      "invoiceNumber"
    ],
    [
      "Invoice date",
      "invoiceDate"
    ],
    ["Subtotal", "subtotal"],
    ["GST", "gst"],
    ["Total", "total"],
    ["GSTIN", "gstin"]
  ];

  const save = async (values) => {
    try {
      const updated =
        await api(
          `/documents/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify(
              values
            )
          }
        );

      setDoc(updated);
      setEditing(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const act = async (status) => {
    if (
      status === "rejected" &&
      !reason.trim()
    ) {
      alert(
        "Please provide a rejection reason."
      );
      return;
    }

    try {
      const updated =
        await api(
          `/documents/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              status,
              rejectionReason:
                reason
            })
          }
        );

      setDoc(updated);

      nav(
        status === "approved"
          ? "/documents"
          : "/review",
        {
          replace: true
        }
      );
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <PageTitle
        title="Document analysis"
        copy={`${doc.originalName || "Document"} · ${
          doc.confidence ?? "—"
        }% extraction confidence`}
      />

      <div className="detail-grid">
        <section className="panel">
          <p className="eyebrow">
            EXTRACTED INFORMATION
          </p>

          {editing ? (
            <EditForm
              doc={doc}
              fields={fields}
              save={save}
              cancel={() =>
                setEditing(false)
              }
            />
          ) : (
            fields.map(([label, key]) => (
              <div
                className="field"
                key={key}
              >
                <span>
                  {label}
                </span>

                <b>
                  {key ===
                  "invoiceDate"
                    ? doc[key]
                      ? new Date(
                          doc[key]
                        ).toLocaleDateString()
                      : "Not found"
                    : [
                        "subtotal",
                        "gst",
                        "total"
                      ].includes(key)
                    ? money(doc[key])
                    : doc[key] ||
                      "Not found"}
                </b>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">
            VALIDATION
          </p>

          <h2>
            {doc.issues?.length
              ? "Issues found"
              : "Ready for review"}
          </h2>

          <ul>
            {doc.issues?.length ? (
              doc.issues.map(
                (issue, index) => (
                  <li key={index}>
                    ⚠ {issue}
                  </li>
                )
              )
            ) : (
              <li>
                ✓ AI validation completed
              </li>
            )}
          </ul>

          <p>
            OCR:{" "}
            <b>
              {doc.ocrStatus ||
                "Not processed"}
            </b>
          </p>

          {user.role ===
            "accountant" && (
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setEditing(true)
                }
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() =>
                  act("approved")
                }
              >
                Approve
              </button>

              <input
                placeholder="Rejection reason"
                value={reason}
                onChange={(e) =>
                  setReason(
                    e.target.value
                  )
                }
              />

              <button
                type="button"
                className="danger"
                onClick={() =>
                  act("rejected")
                }
              >
                Reject
              </button>
            </div>
          )}

          <details>
            <summary>
              View OCR text
            </summary>

            <pre>
              {doc.rawText ||
                "No OCR text available."}
            </pre>
          </details>
        </section>
      </div>
    </>
  );
}

/* =========================================================
   EDIT FORM
========================================================= */

function EditForm({
  doc,
  fields,
  save,
  cancel
}) {
  const [values, setValues] =
    useState(() =>
      Object.fromEntries(
        fields.map(
          ([, key]) => [
            key,
            key === "invoiceDate" &&
            doc[key]
              ? new Date(
                  doc[key]
                )
                  .toISOString()
                  .slice(0, 10)
              : doc[key] ?? ""
          ]
        )
      )
    );

  const updateValue = (
    key,
    value
  ) => {
    setValues(
      (previous) => ({
        ...previous,
        [key]: value
      })
    );
  };

  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        save(values);
      }}
    >
      {fields.map(
        ([label, key]) => (
          <label key={key}>
            {label}

            <input
              type={
                [
                  "subtotal",
                  "gst",
                  "total"
                ].includes(key)
                  ? "number"
                  : key ===
                    "invoiceDate"
                  ? "date"
                  : "text"
              }
              value={
                values[key]
              }
              onChange={(e) =>
                updateValue(
                  key,
                  e.target.value
                )
              }
            />
          </label>
        )
      )}

      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={cancel}
        >
          Cancel
        </button>

        <button type="submit">
          Save
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   REVIEW QUEUE
========================================================= */

function Review() {
  const [docs, setDocs] =
    useState(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    api("/documents")
      .then((data) => {
        if (!active) {
          return;
        }

        const documents =
          Array.isArray(data)
            ? data
            : [];

        setDocs(
          documents.filter(
            (document) =>
              document.status ===
                "review" ||
              document.status ===
                "pending"
          )
        );
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageTitle
        title="Review queue"
        copy="Open a document to edit, approve, or reject it."
      />

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      <section className="panel">
        {docs ? (
          <>
            <DocumentTable
              docs={docs}
              user={{
                role: "accountant"
              }}
            />

            {!docs.length && (
              <p className="empty">
                No documents waiting for review.
              </p>
            )}
          </>
        ) : (
          <Loading />
        )}
      </section>
    </>
  );
}

/* =========================================================
   REPORTS
========================================================= */

function Reports() {
  const [report, setReport] =
    useState(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    api("/reports")
      .then((data) => {
        if (active) {
          setReport(data);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <>
        <PageTitle
          title="Reports"
          copy="Live document activity from your workspace."
        />

        <p className="error">
          {error}
        </p>
      </>
    );
  }

  if (!report) {
    return <Loading />;
  }

  const status =
    report.status || {};

  const activity =
    report.activity || {};

  const statusValues =
    Object.values(status)
      .map(Number)
      .filter(
        (value) =>
          !Number.isNaN(value)
      );

  const maxStatus = Math.max(
    ...statusValues,
    1
  );

  const activityValues =
    Object.values(activity)
      .map(Number)
      .filter(
        (value) =>
          !Number.isNaN(value)
      );

  const maxActivity = Math.max(
    ...activityValues,
    1
  );

  return (
    <>
      <PageTitle
        title="Reports"
        copy="Live document activity from your workspace."
      />

      <Metrics
        data={report}
      />

      <section className="panel">
        <h2>
          Documents by status
        </h2>

        {Object.entries(status).map(
          ([key, value]) => (
            <div
              className="chart-row"
              key={key}
            >
              <span>
                {key}
              </span>

              <i
                style={{
                  width: `${
                    (Number(value) /
                      maxStatus) *
                    100
                  }%`
                }}
              />

              <b>
                {value}
              </b>
            </div>
          )
        )}

        {!Object.keys(status)
          .length && (
          <p className="empty">
            No status data available.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>
          Upload activity
        </h2>

        {Object.entries(activity)
          .sort(([a], [b]) =>
            a.localeCompare(b)
          )
          .slice(-8)
          .map(([date, value]) => (
            <div
              className="chart-row"
              key={date}
            >
              <span>
                {date}
              </span>

              <i
                style={{
                  width: `${
                    (Number(value) /
                      maxActivity) *
                    100
                  }%`
                }}
              />

              <b>
                {value}
              </b>
            </div>
          ))}

        {!Object.keys(activity)
          .length && (
          <p className="empty">
            No upload activity yet.
          </p>
        )}
      </section>
    </>
  );
}

/* =========================================================
   CHANGE ACCOUNTANT
========================================================= */

function ChangeRequest() {
  const [orgs, setOrgs] =
    useState([]);

  const [org, setOrg] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    api("/organizations")
      .then((data) => {
        setOrgs(
          Array.isArray(data)
            ? data
            : []
        );
      })
      .catch((e) => {
        setError(e.message);
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setMessage("");
    setError("");

    try {
      await api(
        "/client/accountant-change-requests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            requestedOrganization:
              org,
            reason
          })
        }
      );

      setMessage(
        "Request submitted to the organization."
      );

      setReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Request accountant change"
        copy="Your accountant will not change until the organization approves this request."
      />

      <form
        className="upload-form"
        onSubmit={submit}
      >
        <label>
          Requested organization

          <select
            required
            value={org}
            onChange={(e) =>
              setOrg(
                e.target.value
              )
            }
          >
            <option value="">
              Select organization
            </option>

            {orgs.map((x) => (
              <option
                value={x.name}
                key={x._id || x.name}
              >
                {x.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Reason (optional)

          <input
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
          />
        </label>

        <button
          type="submit"
          disabled={busy}
        >
          {busy
            ? "Submitting..."
            : "Submit request"}
        </button>

        {message && (
          <p className="notice">
            {message}
          </p>
        )}

        {error && (
          <p className="error">
            {error}
          </p>
        )}
      </form>
    </>
  );
}

/* =========================================================
   COMMON COMPONENTS
========================================================= */

function PageTitle({
  title,
  copy
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">
        WORKSPACE
      </p>

      <h2>
        {title}
      </h2>

      <p>
        {copy}
      </p>
    </div>
  );
}

function Loading() {
  return (
    <p className="loading">
      Loading…
    </p>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [state, setState] =
    useState(() => {
      const token =
        localStorage.getItem(
          "token"
        );

      let user = null;

      try {
        const storedUser =
          localStorage.getItem(
            "user"
          );

        user = storedUser
          ? JSON.parse(storedUser)
          : null;
      } catch {
        localStorage.removeItem(
          "user"
        );
        user = null;
      }

      /*
        If the saved user doesn't contain
        a role, don't allow the application
        to enter the protected shell.
      */

      if (
        user &&
        !user.role
      ) {
        user = null;
      }

      return {
        token,
        user
      };
    });

  const onAuth = (data) => {
    const token =
      data?.token || null;

    const user =
      data?.user ||
      data?.data?.user ||
      data?.data ||
      null;

    if (!token || !user) {
      throw new Error(
        "Invalid authentication response."
      );
    }

    localStorage.setItem(
      "token",
      token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(user)
    );

    setState({
      token,
      user
    });
  };

  const logout = () => {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    setState({
      token: null,
      user: null
    });
  };

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          state.token &&
          state.user ? (
            <Navigate
              to="/dashboard"
              replace
            />
          ) : (
            <Auth
              onAuth={onAuth}
            />
          )
        }
      />

      <Route
        path="/*"
        element={
          state.token &&
          state.user &&
          state.user.role ? (
            <Shell
              user={state.user}
              onLogout={logout}
            />
          ) : (
            <Navigate
              to="/auth"
              replace
            />
          )
        }
      />
    </Routes>
  );
}

/* =========================================================
   REACT ENTRY POINT
========================================================= */

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);