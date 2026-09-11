import React, { useEffect, useMemo, useState } from "react";
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

/* =========================================================
   API HELPER
========================================================= */

async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(token
      ? {
          Authorization: `Bearer ${token}`
        }
      : {}),
    ...(options.headers || {})
  };

  const response = await fetch(API + path, {
    ...options,
    headers
  });

  let body = null;

  try {
    body =
      response.status === 204
        ? null
        : await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      body?.message || "Request failed"
    );
  }

  return body;
}

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return `₹${number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN");
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN");
}

function prettyKey(key) {
  if (!key) {
    return "";
  }

  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function formatFieldValue(key, value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not found";
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(
      value,
      null,
      2
    );
  }

  const lowerKey = String(key).toLowerCase();

  if (
    lowerKey.includes("date") &&
    typeof value === "string"
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    (
      lowerKey.includes("amount") ||
      lowerKey.includes("total") ||
      lowerKey.includes("subtotal") ||
      lowerKey.includes("gst") ||
      lowerKey.includes("tax") ||
      lowerKey.includes("price") ||
      lowerKey.includes("cost")
    )
  ) {
    return money(value);
  }

  return String(value);
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    id: user.id || user._id || null,
    role: user.role
      ? String(user.role).toLowerCase()
      : null
  };
}

/* =========================================================
   AUTH
========================================================= */

function Auth({ onAuth }) {
  const [register, setRegister] =
    useState(false);

  const [role, setRole] =
    useState("client");

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    organization: "",
    accountantId: "",
    branch: ""
  });

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

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
            email: form.email.trim(),
            password: form.password
          };
        } else {
          payload = {
            role: "accountant",
            name: form.name.trim(),
            organization:
              form.organization.trim(),
            accountantId:
              form.accountantId.trim(),
            branch: form.branch.trim(),
            email: form.email.trim(),
            password: form.password
          };
        }
      } else {
        payload = {
          email: form.email.trim(),
          password: form.password
        };
      }

      const response = await api(
        `/auth/${
          register
            ? "register"
            : "login"
        }`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response?.token) {
        throw new Error(
          "Authentication token was not returned by the server."
        );
      }

      const authenticatedUser =
        normalizeUser(
          response?.user ||
            response?.data?.user ||
            response?.data ||
            null
        );

      if (!authenticatedUser) {
        throw new Error(
          "User information was not returned by the server."
        );
      }

      if (!authenticatedUser.role) {
        throw new Error(
          "User role was not returned by the server."
        );
      }

      onAuth({
        token: response.token,
        user: authenticatedUser
      });

      nav("/dashboard", {
        replace: true
      });
    } catch (e) {
      setError(
        e.message ||
          "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <section className="auth-card">
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

        <p className="auth-description">
          {register
            ? "Create your LedgerAgent workspace account."
            : "Sign in to continue to your accounting workspace."}
        </p>

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

          {register &&
            role === "accountant" && (
              <>
                <label>
                  Name

                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      set(
                        "name",
                        e.target.value
                      )
                    }
                    placeholder="Full name"
                  />
                </label>

                <label>
                  Organization

                  <input
                    type="text"
                    required
                    value={
                      form.organization
                    }
                    onChange={(e) =>
                      set(
                        "organization",
                        e.target.value
                      )
                    }
                    placeholder="Organization name"
                  />
                </label>

                <label>
                  Branch

                  <input
                    type="text"
                    value={form.branch}
                    onChange={(e) =>
                      set(
                        "branch",
                        e.target.value
                      )
                    }
                    placeholder="Optional branch"
                  />
                </label>

                <label>
                  Accountant ID

                  <input
                    type="text"
                    required
                    value={
                      form.accountantId
                    }
                    onChange={(e) =>
                      set(
                        "accountantId",
                        e.target.value
                      )
                    }
                    placeholder="Accountant ID"
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
                set(
                  "email",
                  e.target.value
                )
              }
              placeholder="you@example.com"
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
                set(
                  "password",
                  e.target.value
                )
              }
              placeholder="Minimum 6 characters"
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
              ? "Please wait..."
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
            {register
              ? "Login"
              : "Register"}
          </button>
        </p>
      </section>
    </main>
  );
}

/* =========================================================
   MAIN SHELL
========================================================= */

function Shell({
  user,
  onLogout
}) {
  const navigate = useNavigate();

  if (!user || !user.role) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  const role =
    String(user.role).toLowerCase();

  const displayName =
    user.name ||
    user.email ||
    "User";

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]
      )
      .join("")
      .toUpperCase() || "U";

  const nav =
    role === "accountant"
      ? [
          [
            "dashboard",
            "Dashboard"
          ],
          [
            "documents",
            "Client documents"
          ],
          [
            "review",
            "Review queue"
          ],
          [
            "reports",
            "Reports"
          ]
        ]
      : [
          [
            "dashboard",
            "Dashboard"
          ],
          [
            "documents",
            "My documents"
          ],
          [
            "upload",
            "Upload document"
          ],
          [
            "reports",
            "Reports"
          ]
        ];

  const handleLogout = () => {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

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

        <nav className="main-nav">
          {nav.map(
            ([to, label]) => (
              <NavLink
                to={`/${to}`}
                key={to}
                end={
                  to ===
                  "dashboard"
                }
              >
                {label}
              </NavLink>
            )
          )}
        </nav>

        <div className="side-user">
          <b>{initials}</b>

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
          onClick={
            handleLogout
          }
        >
          Logout
        </button>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">
              {role.toUpperCase()}{" "}
              WORKSPACE
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
              <Dashboard
                user={user}
              />
            }
          />

          <Route
            path="documents"
            element={
              <Documents
                user={user}
              />
            }
          />

          <Route
            path="upload"
            element={
              role === "client" ? (
                <Upload />
              ) : (
                <Navigate
                  to="/dashboard"
                  replace
                />
              )
            }
          />

          <Route
            path="documents/:id"
            element={
              <Details
                user={user}
              />
            }
          />

          <Route
            path="review"
            element={
              role ===
              "accountant" ? (
                <Review />
              ) : (
                <Navigate
                  to="/dashboard"
                  replace
                />
              )
            }
          />

          <Route
            path="reports"
            element={
              <Reports
                user={user}
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

function Assignment({
  onDone
}) {
  const [orgs, setOrgs] =
    useState([]);

  const [org, setOrg] =
    useState("");

  const [
    accountants,
    setAccountants
  ] = useState([]);

  const [
    accountantId,
    setAccountantId
  ] = useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    let active = true;

    api("/organizations")
      .then((data) => {
        if (!active) {
          return;
        }

        setOrgs(
          Array.isArray(data)
            ? data
            : []
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

  useEffect(() => {
    if (!org) {
      setAccountants([]);
      setAccountantId("");
      return;
    }

    setError("");
    setAccountantId("");

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
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            organization: org,
            accountantId
          })
        }
      );

      const updatedUser =
        normalizeUser(
          data?.user || data
        );

      if (updatedUser) {
        localStorage.setItem(
          "user",
          JSON.stringify(
            updatedUser
          )
        );
      }

      onDone(updatedUser);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel assignment">
      <div className="assignment-icon">
        ◈
      </div>

      <p className="eyebrow">
        FIRST-TIME SETUP
      </p>

      <h2>
        Select your organization
      </h2>

      <p>
        Choose your organization and
        assigned accountant before
        uploading documents.
      </p>

      <label>
        Organization

        <select
          value={org}
          onChange={(e) =>
            setOrg(e.target.value)
          }
          required
        >
          <option value="">
            Choose organization
          </option>

          {orgs.map((x) => (
            <option
              value={x.name}
              key={
                x._id ||
                x.name
              }
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

            {accountants.map(
              (x) => (
                <option
                  value={x._id}
                  key={x._id}
                >
                  {x.name ||
                    x.email}{" "}
                  —{" "}
                  {x.branch ||
                    "Branch not specified"}
                </option>
              )
            )}
          </select>
        </label>
      )}

      <button
        type="button"
        disabled={
          !accountantId ||
          loading
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

function Dashboard({
  user
}) {
  const [data, setData] =
    useState(null);

  const [
    currentUser,
    setCurrentUser
  ] = useState(user);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    setError("");
    setData(null);

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
  }, [currentUser]);

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
        onDone={(updatedUser) => {
          if (updatedUser) {
            localStorage.setItem(
              "user",
              JSON.stringify(
                updatedUser
              )
            );

            setCurrentUser(
              updatedUser
            );
          } else {
            setCurrentUser({
              ...currentUser
            });
          }
        }}
      />
    );
  }

  const clientList =
    Array.isArray(
      data.clientList
    )
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
              {
                data.assignment
                  .organization
              }
            </b>{" "}
            · Accountant:{" "}
            <b>
              {
                data.assignment
                  .accountant
                  ?.name
              }
            </b>{" "}
            (
            {
              data.assignment
                .accountant
                ?.branch ||
              "Branch not specified"
            }
            )
          </p>
        )}
      </div>

      <Metrics
        data={data}
        accountant={
          user.role ===
          "accountant"
        }
      />

      {user.role ===
        "accountant" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                CLIENTS
              </p>

              <h2>
                Assigned clients
              </h2>
            </div>

            <span className="count-badge">
              {clientList.length}
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    CLIENT
                  </th>

                  <th>
                    ORGANIZATION
                  </th>

                  <th>
                    DOCUMENTS
                  </th>

                  <th>
                    PENDING
                  </th>
                </tr>
              </thead>

              <tbody>
                {clientList.map(
                  (x) => (
                    <tr
                      key={
                        x._id ||
                        x.id ||
                        x.email
                      }
                    >
                      <td>
                        <b>
                          {x.name ||
                            x.email ||
                            "Unknown"}
                        </b>
                      </td>

                      <td>
                        {x.organization ||
                          "—"}
                      </td>

                      <td>
                        {x.documents ||
                          0}
                      </td>

                      <td>
                        <span className="status pending">
                          {x.pending ||
                            0}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {!clientList.length && (
            <p className="empty">
              No clients assigned yet.
            </p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              ACTIVITY
            </p>

            <h2>
              Recent documents
            </h2>
          </div>
        </div>

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
        [
          "Clients",
          data.clients
        ],
        [
          "Total documents",
          data.total
        ],
        [
          "Pending review",
          data.pending
        ],
        [
          "Approved",
          data.approved
        ],
        [
          "Rejected",
          data.rejected
        ]
      ]
    : [
        [
          "Total documents",
          data.total
        ],
        [
          "Pending",
          data.pending
        ],
        [
          "Approved",
          data.approved
        ],
        [
          "Rejected",
          data.rejected
        ]
      ];

  return (
    <div className="metrics">
      {metrics.map(
        ([label, value]) => (
          <article
            key={label}
          >
            <p>{label}</p>

            <strong>
              {value ?? 0}
            </strong>
          </article>
        )
      )}
    </div>
  );
}

/* =========================================================
   DOCUMENTS
========================================================= */

function Documents({
  user
}) {
  const [docs, setDocs] =
    useState([]);

  const [error, setError] =
    useState("");

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
          user.role ===
          "client"
            ? "My documents"
            : "Client documents"
        }
        copy={
          user.role ===
          "accountant"
            ? "Review documents uploaded by your assigned clients."
            : "Documents uploaded to your assigned accountant."
        }
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
                user.role ===
                "client"
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
  const nav =
    useNavigate();

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              DOCUMENT
            </th>

            {user.role ===
              "accountant" && (
              <th>
                CLIENT
              </th>
            )}

            <th>
              TYPE
            </th>

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
              className="clickable-row"
            >
              <td>
                <div className="document-name">
                  <b>
                    {d.originalName ||
                      "Unnamed document"}
                  </b>

                  <small>
                    {d.vendor ||
                      d.documentType ||
                      "Original document"}
                  </small>
                </div>
              </td>

              {user.role ===
                "accountant" && (
                <td>
                  {d.client?.name ||
                    d.client?.email ||
                    "—"}
                </td>
              )}

              <td>
                {d.documentType ||
                  "Not classified"}
              </td>

              <td>
                {d.createdAt
                  ? formatDate(
                      d.createdAt
                    )
                  : "—"}
              </td>

              <td>
                <span
                  className={`ocr-badge ${
                    d.ocrStatus ||
                    "pending"
                  }`}
                >
                  {d.ocrStatus ||
                    "pending"}
                </span>
              </td>

              <td>
                <span
                  className={`status ${
                    d.status ||
                    "pending"
                  }`}
                >
                  {d.status ||
                    "pending"}
                </span>
              </td>

              <td>
                {onDelete && (
                  <button
                    type="button"
                    className="secondary small-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(
                        d._id
                      );
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
    </div>
  );
}

/* =========================================================
   UPLOAD
========================================================= */

function Upload() {
  const [file, setFile] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const nav = useNavigate();

  const selectFile = (selected) => {
    if (!selected) {
      setFile(null);
      return;
    }

    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg"
    ];

    if (
      !allowed.includes(
        selected.type
      )
    ) {
      setMessage(
        "Only PDF, JPG and PNG files are allowed."
      );
      setFile(null);
      return;
    }

    if (
      selected.size >
      20 * 1024 * 1024
    ) {
      setMessage(
        "File size must be 20 MB or less."
      );
      setFile(null);
      return;
    }

    setMessage("");
    setFile(selected);
  };

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

      /*
        IMPORTANT:
        No documentType is sent.

        The client only uploads the
        original document.

        OCR + Gemini classification
        happen later when the
        accountant processes it.
      */

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
        copy="Upload the original document. Your assigned accountant will process it with OCR and AI."
      />

      <form
        className="upload-form"
        onSubmit={submit}
      >
        <div className="upload-info">
          <div>
            <b>
              AI processing
            </b>

            <span>
              OCR and document
              classification are
              performed by the
              accountant after upload.
            </span>
          </div>

          <div>
            <b>
              Supported files
            </b>

            <span>
              PDF, JPG and PNG up to
              20 MB
            </span>
          </div>
        </div>

        <label
          className={`drop ${
            dragging
              ? "dragging"
              : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() =>
            setDragging(false)
          }
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);

            selectFile(
              e.dataTransfer
                .files?.[0]
            );
          }}
        >
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) =>
              selectFile(
                e.target.files?.[0] ||
                  null
              )
            }
          />

          <span className="upload-icon">
            ↑
          </span>

          <b>
            {file?.name ||
              "Choose a PDF, JPG or PNG"}
          </b>

          <small>
            {file
              ? `${(
                  file.size /
                  (1024 * 1024)
                ).toFixed(2)} MB`
              : "Maximum 20 MB"}
          </small>
        </label>

        <button
          type="submit"
          disabled={
            !file || busy
          }
        >
          {busy
            ? "Uploading..."
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

function Details({
  user
}) {
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

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState(false);

  const [processMessage, setProcessMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    api("/documents")
      .then((documents) => {
        if (!active) {
          return;
        }

        const found =
          Array.isArray(
            documents
          )
            ? documents.find(
                (x) =>
                  String(
                    x._id
                  ) === String(id)
              )
            : null;

        if (!found) {
          setError(
            "Document not found."
          );
        }

        setDoc(
          found || null
        );
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const refresh = async () => {
    const documents =
      await api(
        "/documents"
      );

    const found =
      Array.isArray(
        documents
      )
        ? documents.find(
            (x) =>
              String(x._id) ===
              String(id)
          )
        : null;

    setDoc(found || null);
  };

  const processDocument =
    async () => {
      setProcessing(true);
      setProcessMessage("");
      setError("");

      try {
        const updated =
          await api(
            `/documents/${id}/process`,
            {
              method: "POST"
            }
          );

        setDoc(updated);

        setProcessMessage(
          "OCR and AI processing completed successfully."
        );
      } catch (e) {
        setError(
          e.message ||
            "Document processing failed."
        );

        try {
          await refresh();
        } catch {
          // Ignore refresh failure.
        }
      } finally {
        setProcessing(false);
      }
    };

  if (loading) {
    return <Loading />;
  }

  if (error && !doc) {
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
    return (
      <p className="error">
        Document not found.
      </p>
    );
  }

  const extractedFields =
    doc.extractedFields &&
    typeof doc.extractedFields ===
      "object"
      ? doc.extractedFields
      : {};

  const hasExtractedFields =
    Object.keys(
      extractedFields
    ).length > 0;

  const issues =
    Array.isArray(
      doc.issues
    )
      ? doc.issues
      : Array.isArray(
          doc.validationIssues
        )
      ? doc.validationIssues
      : [];

  const aiIssues =
    Array.isArray(
      doc.aiValidationIssues
    )
      ? doc.aiValidationIssues
      : [];

  const allIssues = [
    ...issues,
    ...aiIssues
  ].filter(Boolean);

  const save = async (
    values
  ) => {
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

  const act = async (
    status
  ) => {
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
                reason.trim()
            })
          }
        );

      setDoc(updated);
      setReason("");

      if (
        status === "approved"
      ) {
        alert(
          "Document approved successfully."
        );
      } else {
        alert(
          "Document rejected successfully."
        );
      }
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <PageTitle
        title="Document analysis"
        copy={`${doc.originalName || "Document"} · ${
          doc.confidence !==
            null &&
          doc.confidence !==
            undefined
            ? `${(
                Number(
                  doc.confidence
                ) <= 1
                  ? Number(
                      doc.confidence
                    ) * 100
                  : Number(
                      doc.confidence
                    )
              ).toFixed(1)}% extraction confidence`
            : "Confidence unavailable"
        }`}
      />

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {processMessage && (
        <p className="notice">
          {processMessage}
        </p>
      )}

      <div className="detail-grid">
        <section className="panel document-preview-panel">
          <p className="eyebrow">
            ORIGINAL DOCUMENT
          </p>

          <h2>
            {doc.originalName ||
              "Uploaded document"}
          </h2>

          <OriginalDocument
            document={doc}
          />
        </section>

        <section className="panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">
                DOCUMENT
              </p>

              <h2>
                {doc.documentType ||
                  "Not classified"}
              </h2>
            </div>

            <span
              className={`status ${
                doc.status ||
                "pending"
              }`}
            >
              {doc.status ||
                "pending"}
            </span>
          </div>

          <div className="document-meta">
            <div>
              <span>
                OCR status
              </span>

              <b>
                {doc.ocrStatus ||
                  "pending"}
              </b>
            </div>

            <div>
              <span>
                Uploaded
              </span>

              <b>
                {formatDateTime(
                  doc.createdAt
                )}
              </b>
            </div>

            {user.role ===
              "accountant" && (
              <div>
                <span>
                  Client
                </span>

                <b>
                  {doc.client
                    ?.name ||
                    doc.client
                      ?.email ||
                    "—"}
                </b>
              </div>
            )}
          </div>

          {user.role ===
            "accountant" &&
            (
              doc.ocrStatus ===
                "pending" ||
              doc.status ===
                "pending"
            ) && (
              <div className="process-box">
                <div>
                  <b>
                    Ready for AI
                    processing
                  </b>

                  <p>
                    Process this original
                    document to run OCR,
                    classify its type and
                    extract the fields
                    automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    processDocument
                  }
                  disabled={
                    processing
                  }
                >
                  {processing
                    ? "Processing OCR + AI..."
                    : "Process with AI"}
                </button>
              </div>
            )}

          <p className="eyebrow detail-eyebrow">
            EXTRACTED INFORMATION
          </p>

          {editing ? (
            <DynamicEditForm
              fields={
                extractedFields
              }
              save={async (
                updatedFields
              ) => {
                await save({
                  extractedFields:
                    updatedFields
                });
              }}
              cancel={() =>
                setEditing(false)
              }
            />
          ) : hasExtractedFields ? (
            <DynamicFields
              fields={
                extractedFields
              }
            />
          ) : (
            <div className="empty extraction-empty">
              <b>
                No extracted fields yet
              </b>

              <p>
                {user.role ===
                "accountant"
                  ? "Click “Process with AI” to run OCR and extract the document data."
                  : "Your accountant has not processed this document yet."}
              </p>
            </div>
          )}

          {doc.items &&
            Array.isArray(
              doc.items
            ) &&
            doc.items.length > 0 && (
              <ItemsTable
                items={doc.items}
              />
            )}
        </section>

        <section className="panel validation-panel">
          <p className="eyebrow">
            VALIDATION
          </p>

          <h2>
            {allIssues.length
              ? "Issues found"
              : doc.ocrStatus ===
                  "completed"
              ? "Ready for review"
              : "Waiting for processing"}
          </h2>

          {allIssues.length ? (
            <ul className="issue-list">
              {allIssues.map(
                (
                  issue,
                  index
                ) => (
                  <li
                    key={index}
                  >
                    <span>
                      ⚠
                    </span>

                    {issue}
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="success-message">
              ✓ No validation issues
              found.
            </p>
          )}

          <div className="validation-meta">
            <div>
              <span>
                OCR
              </span>

              <b>
                {doc.ocrStatus ||
                  "pending"}
              </b>
            </div>

            <div>
              <span>
                AI confidence
              </span>

              <b>
                {doc.confidence !==
                  null &&
                doc.confidence !==
                  undefined
                  ? `${
                      Number(
                        doc.confidence
                      ) <= 1
                        ? (
                            Number(
                              doc.confidence
                            ) *
                            100
                          ).toFixed(
                            1
                          )
                        : Number(
                            doc.confidence
                          ).toFixed(
                            1
                          )
                    }%`
                  : "—"}
              </b>
            </div>
          </div>

          {user.role ===
            "accountant" && (
            <div className="actions">
              {doc.ocrStatus ===
                "completed" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setEditing(
                      true
                    )
                  }
                >
                  Edit extracted data
                </button>
              )}

              <button
                type="button"
                disabled={
                  doc.status ===
                    "approved" ||
                  doc.ocrStatus !==
                    "completed"
                }
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
                disabled={
                  doc.status ===
                  "approved"
                }
              />

              <button
                type="button"
                className="danger"
                disabled={
                  doc.status ===
                    "approved" ||
                  doc.ocrStatus !==
                    "completed"
                }
                onClick={() =>
                  act("rejected")
                }
              >
                Reject
              </button>
            </div>
          )}

          {doc.rejectionReason && (
            <div className="rejection-box">
              <b>
                Rejection reason
              </b>

              <p>
                {
                  doc.rejectionReason
                }
              </p>
            </div>
          )}

          {doc.rawText && (
            <details>
              <summary>
                View OCR text
              </summary>

              <pre>
                {doc.rawText}
              </pre>
            </details>
          )}
        </section>
      </div>
    </>
  );
}

/* =========================================================
   ORIGINAL DOCUMENT VIEWER
========================================================= */

function OriginalDocument({
  document
}) {
  const [url, setUrl] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const loadFile =
      async () => {
        setLoading(true);
        setError("");

        try {
          const token =
            localStorage.getItem(
              "token"
            );

          const response =
            await fetch(
              `${API}/documents/${document._id}/file`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );

          if (
            !response.ok
          ) {
            let message =
              "Unable to load original document.";

            try {
              const body =
                await response.json();

              message =
                body?.message ||
                message;
            } catch {
              // Ignore invalid JSON.
            }

            throw new Error(
              message
            );
          }

          const blob =
            await response.blob();

          objectUrl =
            URL.createObjectURL(
              blob
            );

          if (active) {
            setUrl(
              objectUrl
            );
          }
        } catch (e) {
          if (active) {
            setError(
              e.message
            );
          }
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    loadFile();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl
        );
      }
    };
  }, [document._id]);

  if (loading) {
    return (
      <div className="document-viewer-loading">
        Loading original document...
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-viewer-error">
        <p className="error">
          {error}
        </p>
      </div>
    );
  }

  if (!url) {
    return (
      <p className="empty">
        Original document is
        unavailable.
      </p>
    );
  }

  const isPdf =
    document.mimeType ===
      "application/pdf" ||
    document.originalName
      ?.toLowerCase()
      .endsWith(".pdf");

  const isImage =
    document.mimeType?.startsWith(
      "image/"
    ) ||
    /\.(png|jpg|jpeg)$/i.test(
      document.originalName ||
        ""
    );

  return (
    <div className="document-viewer">
      {isPdf && (
        <iframe
          src={url}
          title="Original document"
        />
      )}

      {isImage && (
        <img
          src={url}
          alt={
            document.originalName ||
            "Original document"
          }
        />
      )}

      {!isPdf && !isImage && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="document-open-link"
        >
          Open original document
        </a>
      )}
    </div>
  );
}

/* =========================================================
   DYNAMIC FIELDS
========================================================= */

function DynamicFields({
  fields = {}
}) {
  const entries =
    Object.entries(fields);

  if (!entries.length) {
    return (
      <p className="empty">
        No extracted information.
      </p>
    );
  }

  return (
    <div className="dynamic-fields">
      {entries.map(
        ([key, value]) => (
          <div
            className="field"
            key={key}
          >
            <span>
              {prettyKey(key)}
            </span>

            <b>
              {formatFieldValue(
                key,
                value
              )}
            </b>
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================
   DYNAMIC EDIT FORM
========================================================= */

function DynamicEditForm({
  fields = {},
  save,
  cancel
}) {
  const initial =
    Object.fromEntries(
      Object.entries(
        fields
      ).map(
        ([key, value]) => [
          key,
          typeof value ===
          "object"
            ? JSON.stringify(
                value
              )
            : value ??
              ""
        ]
      )
    );

  const [
    values,
    setValues
  ] = useState(initial);

  const [newKey, setNewKey] =
    useState("");

  const [
    newValue,
    setNewValue
  ] = useState("");

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

  const addField = () => {
    const key =
      newKey.trim();

    if (!key) {
      return;
    }

    setValues(
      (previous) => ({
        ...previous,
        [key]:
          newValue
      })
    );

    setNewKey("");
    setNewValue("");
  };

  const removeField = (
    key
  ) => {
    setValues(
      (previous) => {
        const next = {
          ...previous
        };

        delete next[key];

        return next;
      }
    );
  };

  const submit = (
    e
  ) => {
    e.preventDefault();

    const cleaned =
      Object.fromEntries(
        Object.entries(
          values
        ).map(
          ([key, value]) => {
            let parsed =
              value;

            if (
              typeof value ===
                "string" &&
              (
                value.trim()
                  .startsWith(
                    "{"
                  ) ||
                value.trim()
                  .startsWith(
                    "["
                  )
              )
            ) {
              try {
                parsed =
                  JSON.parse(
                    value
                  );
              } catch {
                parsed =
                  value;
              }
            }

            return [
              key,
              parsed
            ];
          }
        )
      );

    save(cleaned);
  };

  return (
    <form
      className="edit-form"
      onSubmit={submit}
    >
      {Object.entries(
        values
      ).map(
        ([key, value]) => (
          <div
            className="dynamic-edit-row"
            key={key}
          >
            <label>
              {prettyKey(key)}

              <input
                value={value}
                onChange={(e) =>
                  updateValue(
                    key,
                    e.target
                      .value
                  )
                }
              />
            </label>

            <button
              type="button"
              className="danger small-button"
              onClick={() =>
                removeField(
                  key
                )
              }
            >
              Remove
            </button>
          </div>
        )
      )}

      <div className="add-field">
        <input
          placeholder="New field name"
          value={newKey}
          onChange={(e) =>
            setNewKey(
              e.target.value
            )
          }
        />

        <input
          placeholder="Value"
          value={newValue}
          onChange={(e) =>
            setNewValue(
              e.target.value
            )
          }
        />

        <button
          type="button"
          className="secondary"
          onClick={addField}
        >
          Add field
        </button>
      </div>

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
   ITEMS TABLE
========================================================= */

function ItemsTable({
  items = []
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="items-section">
      <p className="eyebrow">
        LINE ITEMS
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                ITEM
              </th>

              <th>
                QUANTITY
              </th>

              <th>
                UNIT PRICE
              </th>

              <th>
                AMOUNT
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map(
              (item, index) => (
                <tr
                  key={
                    item.id ||
                    index
                  }
                >
                  <td>
                    {item.name ||
                      "—"}
                  </td>

                  <td>
                    {item.quantity ??
                      "—"}
                  </td>

                  <td>
                    {item.unitPrice !==
                      null &&
                    item.unitPrice !==
                      undefined
                      ? money(
                          item.unitPrice
                        )
                      : "—"}
                  </td>

                  <td>
                    {item.amount !==
                      null &&
                    item.amount !==
                      undefined
                      ? money(
                          item.amount
                        )
                      : "—"}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
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

  const load = async () => {
    try {
      const data =
        await api("/documents");

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
              "pending" ||
            document.status ===
              "processing"
        )
      );
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageTitle
        title="Review queue"
        copy="Process client documents, inspect the original file, review extracted data and approve or reject."
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
                No documents waiting
                for review.
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

function Reports({
  user
}) {
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

  const documentTypes =
    report.documentTypes ||
    {};

  const statusValues =
    Object.values(status)
      .map(Number)
      .filter(
        (value) =>
          !Number.isNaN(
            value
          )
      );

  const maxStatus =
    Math.max(
      ...statusValues,
      1
    );

  const activityValues =
    Object.values(activity)
      .map(Number)
      .filter(
        (value) =>
          !Number.isNaN(
            value
          )
      );

  const maxActivity =
    Math.max(
      ...activityValues,
      1
    );

  const typeValues =
    Object.values(
      documentTypes
    )
      .map(Number)
      .filter(
        (value) =>
          !Number.isNaN(
            value
          )
      );

  const maxType =
    Math.max(
      ...typeValues,
      1
    );

  return (
    <>
      <PageTitle
        title="Reports"
        copy={
          user?.role ===
          "accountant"
            ? "Overview of documents handled across your assigned clients."
            : "Overview of your uploaded documents."
        }
      />

      <Metrics
        data={report}
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              STATUS
            </p>

            <h2>
              Documents by status
            </h2>
          </div>
        </div>

        {Object.entries(
          status
        ).map(
          ([key, value]) => (
            <div
              className="chart-row"
              key={key}
            >
              <span>
                {prettyKey(
                  key
                )}
              </span>

              <div className="chart-track">
                <i
                  style={{
                    width: `${
                      (Number(
                        value
                      ) /
                        maxStatus) *
                      100
                    }%`
                  }}
                />
              </div>

              <b>
                {value}
              </b>
            </div>
          )
        )}

        {!Object.keys(
          status
        ).length && (
          <p className="empty">
            No status data available.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              CLASSIFICATION
            </p>

            <h2>
              Documents by type
            </h2>
          </div>
        </div>

        {Object.entries(
          documentTypes
        ).map(
          ([key, value]) => (
            <div
              className="chart-row"
              key={key}
            >
              <span>
                {prettyKey(
                  key
                )}
              </span>

              <div className="chart-track">
                <i
                  style={{
                    width: `${
                      (Number(
                        value
                      ) /
                        maxType) *
                      100
                    }%`
                  }}
                />
              </div>

              <b>
                {value}
              </b>
            </div>
          )
        )}

        {!Object.keys(
          documentTypes
        ).length && (
          <p className="empty">
            No classified documents
            yet.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              ACTIVITY
            </p>

            <h2>
              Upload activity
            </h2>
          </div>
        </div>

        {Object.entries(
          activity
        )
          .sort(
            ([a], [b]) =>
              a.localeCompare(
                b
              )
          )
          .slice(-8)
          .map(
            ([date, value]) => (
              <div
                className="chart-row"
                key={date}
              >
                <span>
                  {date}
                </span>

                <div className="chart-track">
                  <i
                    style={{
                      width: `${
                        (Number(
                          value
                        ) /
                          maxActivity) *
                        100
                      }%`
                    }}
                  />
                </div>

                <b>
                  {value}
                </b>
              </div>
            )
          )}

        {!Object.keys(
          activity
        ).length && (
          <p className="empty">
            No upload activity yet.
          </p>
        )}
      </section>
    </>
  );
}

/* =========================================================
   PAGE TITLE
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

/* =========================================================
   LOADING
========================================================= */

function Loading() {
  return (
    <div className="loading">
      <span className="spinner" />
      Loading...
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [
    state,
    setState
  ] = useState(() => {
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

      user =
        storedUser
          ? normalizeUser(
              JSON.parse(
                storedUser
              )
            )
          : null;
    } catch {
      localStorage.removeItem(
        "user"
      );

      user = null;
    }

    /*
      If a token exists but the
      stored user is invalid,
      remove the broken session.
    */

    if (
      token &&
      (!user || !user.role)
    ) {
      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "user"
      );

      return {
        token: null,
        user: null
      };
    }

    return {
      token,
      user
    };
  });

  const onAuth = (
    data
  ) => {
    const token =
      data?.token ||
      null;

    const user =
      normalizeUser(
        data?.user ||
          data?.data?.user ||
          data?.data ||
          null
      );

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
          state.user &&
          state.user.role ? (
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
              onLogout={
                logout
              }
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
  document.getElementById(
    "root"
  )
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);