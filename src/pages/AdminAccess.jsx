import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  message,
  Table,
  Typography,
  Spin,
  Input,
  Tag,
  Space,
  Modal,
  Form,
  Popconfirm,
  Segmented,
  Divider,
  Grid,
  Switch,
  Alert,
  Drawer,
  InputNumber,
} from "antd";
import {
  UserOutlined,
  SafetyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  CodeOutlined,
  SaveOutlined,
  FileSearchOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusCircleOutlined,
  AppstoreOutlined,
  FontSizeOutlined,
  NumberOutlined,
  FieldTimeOutlined,
  MailOutlined,
} from "@ant-design/icons";
import DynamicForm from "../components/DynamicForm";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

/* ---------------- small helpers ---------------- */
const pretty = (obj) => JSON.stringify(obj, null, 2);
const tryParse = (txt) => {
  try {
    return { ok: true, value: JSON.parse(txt) };
  } catch (e) {
    return { ok: false, error: String(e.message) };
  }
};

const RoleTag = ({ role }) => {
  const color =
    role === "superadmin" ? "red" : role === "admin" ? "blue" : "green";
  return (
    <Tag color={color} style={{ textTransform: "capitalize" }}>
      {role}
    </Tag>
  );
};

/* ---------------- visual builder helpers ---------------- */
const DEFAULT_FORM_TITLE = "New Form";

const FIELD_TYPES = [
  { label: "Short Text", value: "string", icon: <FontSizeOutlined /> },
  { label: "Long Text", value: "text", icon: <FontSizeOutlined /> },
  { label: "Number", value: "number", icon: <NumberOutlined /> },
  { label: "Integer", value: "integer", icon: <NumberOutlined /> },
  { label: "Yes/No", value: "boolean", icon: <CheckCircleOutlined /> },
  { label: "Email", value: "email", icon: <MailOutlined /> },
  { label: "Date", value: "date", icon: <FieldTimeOutlined /> },
  { label: "Dropdown", value: "select", icon: <AppstoreOutlined /> },
];

const slug = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z_]/, "_$&") || "field";

const uniqueKey = (base, used) => {
  let key = slug(base);
  let i = 1;
  while (used.includes(key)) key = `${slug(base)}_${i++}`;
  return key;
};

function buildJsonFromFields(fields, title = DEFAULT_FORM_TITLE) {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    title: title || DEFAULT_FORM_TITLE,
    properties: {},
  };
  const ui = {};
  const required = [];

  for (const f of fields) {
    if (!f.name) continue;
    const key = f.name;

    if (f.type === "string") {
      schema.properties[key] = { type: "string", title: f.label || key };
    } else if (f.type === "text") {
      schema.properties[key] = { type: "string", title: f.label || key };
      ui[key] = {
        ...(ui[key] || {}),
        "ui:widget": "textarea",
        "ui:options": { rows: 3 },
      };
    } else if (f.type === "number") {
      schema.properties[key] = { type: "number", title: f.label || key };
      if (typeof f.min === "number") schema.properties[key].minimum = f.min;
      if (typeof f.max === "number") schema.properties[key].maximum = f.max;
    } else if (f.type === "integer") {
      schema.properties[key] = { type: "integer", title: f.label || key };
      if (typeof f.min === "number") schema.properties[key].minimum = f.min;
      if (typeof f.max === "number") schema.properties[key].maximum = f.max;
    } else if (f.type === "boolean") {
      schema.properties[key] = { type: "boolean", title: f.label || key };
    } else if (f.type === "email") {
      schema.properties[key] = {
        type: "string",
        format: "email",
        title: f.label || key,
      };
    } else if (f.type === "date") {
      schema.properties[key] = {
        type: "string",
        format: "date",
        title: f.label || key,
      };
    } else if (f.type === "select") {
      schema.properties[key] = {
        type: "string",
        title: f.label || key,
        enum: (f.options || []).filter(Boolean),
      };
    }

    if (f.placeholder)
      ui[key] = { ...(ui[key] || {}), "ui:placeholder": f.placeholder };
    if (f.required) required.push(key);
  }
  if (required.length) schema.required = required;
  return { schema, uiSchema: ui };
}

function parseFieldsFromJson(schema, uiSchema) {
  const fields = [];
  if (!schema || schema.type !== "object" || !schema.properties) return fields;

  for (const [name, def] of Object.entries(schema.properties)) {
    const isReq =
      Array.isArray(schema.required) && schema.required.includes(name);
    const ui = uiSchema?.[name] || {};

    let type = "string";
    let options;
    let min, max;

    if (def.type === "string") {
      if (def.format === "email") type = "email";
      else if (def.format === "date") type = "date";
      else if (Array.isArray(def.enum)) {
        type = "select";
        options = def.enum.slice();
      } else if (ui["ui:widget"] === "textarea") type = "text";
      else type = "string";
    } else if (def.type === "number") {
      type = "number";
      min = def.minimum;
      max = def.maximum;
    } else if (def.type === "integer") {
      type = "integer";
      min = def.minimum;
      max = def.maximum;
    } else if (def.type === "boolean") {
      type = "boolean";
    }

    fields.push({
      name,
      label: def.title || name,
      type,
      required: !!isReq,
      placeholder: ui["ui:placeholder"] || "",
      options,
      min: typeof min === "number" ? min : undefined,
      max: typeof max === "number" ? max : undefined,
    });
  }
  return fields;
}

/* ---------------- visual field card ---------------- */
function FieldCard({
  value,
  onChange,
  onDelete,
  onUp,
  onDown,
  isFirst,
  isLast,
}) {
  const {
    label,
    name,
    type,
    required,
    placeholder,
    options = [],
    min,
    max,
  } = value;

  return (
    <Card
      size="small"
      style={{ borderRadius: 10 }}
      bodyStyle={{ paddingTop: 12, paddingBottom: 12 }}
      extra={
        <Space>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={isFirst}
            onClick={onUp}
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={isLast}
            onClick={onDown}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={onDelete}
          />
        </Space>
      }
      title={
        <Space wrap>
          <Text strong>{label || "Untitled field"}</Text>
          <Tag>{name || "key"}</Tag>
          <Tag color="blue">
            {FIELD_TYPES.find((t) => t.value === type)?.label || type}
          </Tag>
          {required ? <Tag color="red">Required</Tag> : <Tag>Optional</Tag>}
        </Space>
      }
    >
      <Row gutter={8} style={{ marginBottom: 6 }}>
        <Col xs={24} md={10}>
          <Text type="secondary">Label</Text>
          <Input
            value={label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="e.g. Full Name"
          />
        </Col>
        <Col xs={24} md={8}>
          <Text type="secondary">Field Key</Text>
          <Input
            value={name}
            onChange={(e) => onChange({ ...value, name: slug(e.target.value) })}
            placeholder="auto-generated"
            addonAfter={
              <Button
                size="small"
                onClick={() =>
                  onChange({ ...value, name: slug(label || "field") })
                }
              >
                Auto
              </Button>
            }
          />
        </Col>
        <Col xs={24} md={6}>
          <Text type="secondary">Type</Text>
          <Select
            style={{ width: "100%" }}
            value={type}
            onChange={(v) =>
              onChange({
                ...value,
                type: v,
                options: v === "select" ? options : undefined,
              })
            }
            options={FIELD_TYPES.map((t) => ({
              label: (
                <Space>
                  {t.icon}
                  {t.label}
                </Space>
              ),
              value: t.value,
            }))}
          />
        </Col>
      </Row>

      <Row gutter={8}>
        <Col xs={24} md={10}>
          <Text type="secondary">Placeholder</Text>
          <Input
            value={placeholder}
            onChange={(e) =>
              onChange({ ...value, placeholder: e.target.value })
            }
            placeholder="Shown as a hint"
          />
        </Col>

        {(type === "number" || type === "integer") && (
          <>
            <Col xs={12} md={7}>
              <Text type="secondary">Min</Text>
              <InputNumber
                style={{ width: "100%" }}
                value={typeof min === "number" ? min : undefined}
                onChange={(v) =>
                  onChange({
                    ...value,
                    min: typeof v === "number" ? v : undefined,
                  })
                }
              />
            </Col>
            <Col xs={12} md={7}>
              <Text type="secondary">Max</Text>
              <InputNumber
                style={{ width: "100%" }}
                value={typeof max === "number" ? max : undefined}
                onChange={(v) =>
                  onChange({
                    ...value,
                    max: typeof v === "number" ? v : undefined,
                  })
                }
              />
            </Col>
          </>
        )}

        {type === "select" && (
          <Col xs={24} md={14}>
            <Text type="secondary">Dropdown Options</Text>
            <Select
              mode="tags"
              style={{ width: "100%" }}
              value={options}
              onChange={(vals) =>
                onChange({ ...value, options: vals.filter(Boolean) })
              }
              placeholder="Type an option and press Enter"
            />
          </Col>
        )}

        <Col xs={24} md={4} style={{ display: "flex", alignItems: "flex-end" }}>
          <Space>
            <Text type="secondary">Required</Text>
            <Switch
              checked={!!required}
              onChange={(v) => onChange({ ...value, required: v })}
            />
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

/* ------------------------------- Page ---------------------------------- */
export default function AdminAccess() {
  const screensBp = useBreakpoint();
  const isMobile = !screensBp.md;

  // ----- users state -----
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimer = useRef(null);

  // ----- meta/access state -----
  const [divisions, setDivisions] = useState([]);
  const [screens, setScreens] = useState([]);

  // Single / Bulk selection
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [selectedScreens, setSelectedScreens] = useState([]);

  const [grants, setGrants] = useState([]);

  // op: set (replace), add, remove
  const [op, setOp] = useState("set");
  const [grantLoading, setGrantLoading] = useState(false);

  // ----- modals -----
  const [roleModal, setRoleModal] = useState({
    open: false,
    user: null,
    role: null,
  });
  const [pwdModal, setPwdModal] = useState({ open: false, user: null });
  const [pwdForm] = Form.useForm();

  const [divModalOpen, setDivModalOpen] = useState(false);
  const [divForm] = Form.useForm();

  const [screenModalOpen, setScreenModalOpen] = useState(false);
  const [screenForm] = Form.useForm();

  // UI mode: "Access" | "Users"
  const [mode, setMode] = useState("Access");

  // --- Create User modal state ---
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm] = Form.useForm();
  const [creatingUser, setCreatingUser] = useState(false);

  /* ---------------- Schema Studio (Drawer + Builder) ---------------- */
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [schemaDivisionId, setSchemaDivisionId] = useState(null);
  const [schemaScreenId, setSchemaScreenId] = useState(null);

  // advanced JSON
  const [schemaText, setSchemaText] = useState(
    pretty({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: DEFAULT_FORM_TITLE,
      properties: {},
    })
  );
  const [uiSchemaText, setUiSchemaText] = useState(pretty({}));
  const [activeVersion, setActiveVersion] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // visual builder state
  const [builderTab, setBuilderTab] = useState("Builder"); // Builder | Advanced
  const [formTitle, setFormTitle] = useState(DEFAULT_FORM_TITLE);
  const [fields, setFields] = useState([]);

  /* =========================================================================
   * USERS
   * ========================================================================= */
  const fetchUsers = async ({ q = "", page = 1, limit = 10 } = {}) => {
    setUsersLoading(true);
    try {
      const { data } = await api.get("/admin/users", {
        params: { q, page, limit },
      });
      setUsers(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load users");
      setUsers([]);
      setTotal(0);
    } finally {
      setUsersLoading(false);
    }
  };
  useEffect(() => {
    fetchUsers({ q: userQuery, page });
  }, [page]);

  const onSearchNow = (v) => {
    setUserQuery(v);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchUsers({ q: v, page: 1 }), 400);
  };

  const openCreateUser = () => {
    createUserForm.resetFields();
    createUserForm.setFieldsValue({ role: "user" }); // default
    setCreateUserOpen(true);
  };

  const createUser = async () => {
    try {
      const values = await createUserForm.validateFields();
      setCreatingUser(true);
      await api.post("/admin/users", {
        fullName: values.fullName,
        email: values.email,
        role: values.role,
        password: values.password, // your BE expects 8 chars (same as reset)
      });
      message.success("User created");
      setCreateUserOpen(false);
      // refresh table on page 1 to show the new user
      setPage(1);
      fetchUsers({ q: userQuery, page: 1 });
    } catch (e) {
      if (!e?.errorFields) {
        message.error(e?.response?.data?.message || "Failed to create user");
      }
    } finally {
      setCreatingUser(false);
    }
  };

  /* =========================================================================
   * META
   * ========================================================================= */
  const loadDivisions = async () => {
    const { data } = await api.get("/meta/divisions");
    setDivisions(data);
  };
  const loadScreens = async () => {
    const { data } = await api.get("/meta/screens");
    setScreens(data);
  };
  useEffect(() => {
    loadDivisions();
    loadScreens();
  }, []);

  /* =========================================================================
   * ACCESS
   * ========================================================================= */
  const loadUserGrants = async (userId) => {
    try {
      const { data } = await api.get("/access/grants-by-user", {
        params: { userId },
      });
      setGrants(data || []);
    } catch {
      setGrants([]);
    }
  };

  const applyGrants = async () => {
    try {
      setGrantLoading(true);
      const targetUsers = bulkMode
        ? selectedUsers
        : selectedUser
        ? [selectedUser]
        : [];
      const targetDivisions = bulkMode
        ? selectedDivisions
        : selectedDivision
        ? [selectedDivision]
        : [];
      if (!targetUsers.length) return message.error("Select user(s)");
      if (!targetDivisions.length) return message.error("Select division(s)");

      const promises = [];
      for (const u of targetUsers) {
        for (const d of targetDivisions) {
          if (op === "set") {
            promises.push(
              api.post("/access/grant", {
                userId: u,
                divisionId: d,
                screenIds: selectedScreens,
              })
            );
          } else {
            promises.push(
              api.patch("/access/grant/screens", {
                userId: u,
                divisionId: d,
                op,
                screenIds: selectedScreens,
              })
            );
          }
        }
      }
      await Promise.all(promises);
      message.success(
        `Access ${
          op === "set" ? "updated" : op === "add" ? "added" : "removed"
        } for ${targetUsers.length} user(s) across ${
          targetDivisions.length
        } division(s).`
      );
      if (!bulkMode && selectedUser) await loadUserGrants(selectedUser);
      if (bulkMode && selectedUsers.length === 1)
        await loadUserGrants(selectedUsers[0]);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to apply access");
    } finally {
      setGrantLoading(false);
    }
  };

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        label: `${u.fullName} (${u.email}) — ${u.role}`,
        value: u._id,
      })),
    [users]
  );

  /* =========================================================================
   * USER MANAGEMENT
   * ========================================================================= */
  const openRoleModal = (user) =>
    setRoleModal({ open: true, user, role: user.role });
  const changeRole = async () => {
    try {
      await api.patch(`/admin/users/${roleModal.user._id}/role`, {
        role: roleModal.role,
      });
      message.success("Role updated");
      setRoleModal({ open: false, user: null, role: null });
      fetchUsers({ q: userQuery, page });
      if (selectedUser === roleModal.user._id) loadUserGrants(selectedUser);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to update role");
    }
  };

  const openPwdModal = (user) => {
    setPwdModal({ open: true, user });
    pwdForm.resetFields();
  };
  const resetPassword = async () => {
    try {
      const { password } = await pwdForm.validateFields();
      await api.patch(`/admin/users/${pwdModal.user._id}/password`, {
        password,
      });
      message.success("Password reset");
      setPwdModal({ open: false, user: null });
    } catch (e) {
      if (!e?.errorFields)
        message.error(e.response?.data?.message || "Failed to reset password");
    }
  };

  const deleteUser = async (user) => {
    try {
      await api.delete(`/admin/users/${user._id}`);
      message.success("User deleted");
      if (selectedUser === user._id) {
        setSelectedUser(null);
        setGrants([]);
      }
      fetchUsers({ q: userQuery, page: 1 });
      setPage(1);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to delete user");
    }
  };

  const userColumns = [
    {
      title: "User",
      dataIndex: "fullName",
      key: "fullName",
      render: (_, u) => (
        <Space>
          <UserOutlined />
          <div>
            <div style={{ fontWeight: 600 }}>{u.fullName}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {u.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (r) => <RoleTag role={r} />,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, u) => (
        <Space size="small" wrap>
          <Button icon={<SafetyOutlined />} onClick={() => openRoleModal(u)}>
            Change Role
          </Button>
          <Button icon={<KeyOutlined />} onClick={() => openPwdModal(u)}>
            Reset Password
          </Button>
          <Popconfirm
            title="Delete user?"
            description="This cannot be undone."
            okType="danger"
            onConfirm={() => deleteUser(u)}
          >
            <Button icon={<DeleteOutlined />} danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* =========================================================================
   * DIVISION & SCREEN CREATION
   * ========================================================================= */
  const openCreateDivision = () => {
    divForm.resetFields();
    setDivModalOpen(true);
  };
  const createDivision = async () => {
    try {
      const values = await divForm.validateFields();
      await api.post("/meta/divisions", values);
      message.success("Division created");
      setDivModalOpen(false);
      await loadDivisions();
    } catch (e) {
      if (!e?.errorFields)
        message.error(e.response?.data?.message || "Failed to create division");
    }
  };
  const openCreateScreen = () => {
    screenForm.resetFields();
    setScreenModalOpen(true);
  };
  const createScreen = async () => {
    try {
      const values = await screenForm.validateFields();
      await api.post("/meta/screens", values);
      message.success("Screen created");
      setScreenModalOpen(false);
      await loadScreens();
    } catch (e) {
      if (!e?.errorFields)
        message.error(e.response?.data?.message || "Failed to create screen");
    }
  };

  /* =========================================================================
   * SCHEMA STUDIO ACTIONS
   * ========================================================================= */
  const openSchemaStudio = () => {
    setSchemaDivisionId(selectedDivision || schemaDivisionId || null);
    setSchemaScreenId(schemaScreenId || null);
    setSchemaOpen(true);
  };

  // sync builder → JSON whenever fields/title change
  useEffect(() => {
    const { schema, uiSchema } = buildJsonFromFields(fields, formTitle);
    setSchemaText(pretty(schema));
    setUiSchemaText(pretty(uiSchema));
    setPreviewKey((k) => k + 1);
  }, [fields, formTitle]);

  const loadActiveSchema = async () => {
    if (!schemaDivisionId || !schemaScreenId)
      return message.error("Select division & screen");
    setSchemaLoading(true);
    try {
      const { data } = await api.get(
        `/meta/form-definitions/${schemaDivisionId}/${schemaScreenId}`
      );
      if (!data) {
        message.info("No active form definition for this screen");
        setActiveVersion(null);
        setFields([]);
        setFormTitle(DEFAULT_FORM_TITLE);
      } else {
        setActiveVersion(data.version || null);
        // hydrate builder from JSON
        setFields(parseFieldsFromJson(data.schema, data.uiSchema));
        setFormTitle(data.schema?.title || DEFAULT_FORM_TITLE);
        setSchemaText(pretty(data.schema || {}));
        setUiSchemaText(pretty(data.uiSchema || {}));
        message.success(`Loaded active schema (v${data.version})`);
      }
      setPreviewKey((k) => k + 1);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load schema");
    } finally {
      setSchemaLoading(false);
    }
  };

  const applyTemplate = (label) => {
    const TEMPLATES = [
      {
        label: "Blank Object",
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          title: DEFAULT_FORM_TITLE,
          properties: {},
          required: [],
        },
        uiSchema: {},
      },
      {
        label: "Basic Person (name, age, email)",
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          title: "Person Info",
          properties: {
            name: { type: "string", title: "Full Name", minLength: 1 },
            age: { type: "integer", title: "Age", minimum: 0 },
            email: { type: "string", format: "email", title: "Email" },
          },
          required: ["name", "email"],
        },
        uiSchema: {
          name: { "ui:placeholder": "e.g. Priyansh Kumar" },
          age: { "ui:widget": "updown" },
          email: { "ui:placeholder": "name@example.com" },
        },
      },
    ];
    const t = TEMPLATES.find((x) => x.label === label);
    if (!t) return;
    // hydrate builder from template
    setFields(parseFieldsFromJson(t.schema, t.uiSchema));
    setFormTitle(t.schema.title || DEFAULT_FORM_TITLE);
    setSchemaText(pretty(t.schema));
    setUiSchemaText(pretty(t.uiSchema));
    setPreviewKey((k) => k + 1);
  };

  const formatBoth = () => {
    const s = tryParse(schemaText);
    const u = tryParse(uiSchemaText);
    if (s.ok) setSchemaText(pretty(s.value));
    if (u.ok) setUiSchemaText(pretty(u.value));
    if (!s.ok || !u.ok) {
      message.warning(
        `JSON parse issue: ${[!s.ok && "schema", !u.ok && "uiSchema"]
          .filter(Boolean)
          .join(", ")}`
      );
    } else {
      message.success("Formatted");
    }
  };

  const validateShape = () => {
    const s = tryParse(schemaText);
    const u = tryParse(uiSchemaText);
    if (!s.ok) return message.error(`Schema JSON error: ${s.error}`);
    if (!u.ok) return message.error(`UI Schema JSON error: ${u.error}`);
    if (s.value?.type !== "object")
      return message.warning('Root schema should have type: "object".');
    if (s.value && typeof s.value.properties !== "object")
      return message.warning('Schema should include "properties" object.');
    message.success("Looks like valid JSON + sensible shape");
  };

  const saveNewVersion = async () => {
    if (!schemaDivisionId || !schemaScreenId)
      return message.error("Select division & screen");
    const s = tryParse(schemaText);
    const u = tryParse(uiSchemaText);
    if (!s.ok) return message.error(`Schema JSON error: ${s.error}`);
    if (!u.ok) return message.error(`UI Schema JSON error: ${u.error}`);

    setSchemaLoading(true);
    try {
      const { data } = await api.post("/meta/form-definitions", {
        divisionId: schemaDivisionId,
        screenId: schemaScreenId,
        schema: s.value,
        uiSchema: u.value,
      });
      setActiveVersion(data.version);
      message.success(`Saved new version v${data.version} (now active)`);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to save definition");
    } finally {
      setSchemaLoading(false);
    }
  };

  const parsedSchema = useMemo(() => tryParse(schemaText), [schemaText]);
  const parsedUi = useMemo(() => tryParse(uiSchemaText), [uiSchemaText]);
  const canPreview = parsedSchema.ok && parsedUi.ok;

  /* ----------------------------- Render ----------------------------- */
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card
        style={{ borderRadius: 12 }}
        title={
          <Title level={4} style={{ margin: 0 }}>
            Admin Panel
          </Title>
        }
        extra={
          <Segmented
            options={["Access", "Users"]}
            value={mode}
            onChange={setMode}
          />
        }
      >
        {mode === "Access" ? (
          <>
            <Row gutter={[16, 16]}>
              {/* Left: user picker */}
              <Col xs={24} md={10}>
                <Card
                  style={{ borderRadius: 12, height: "100%" }}
                  title="Select User(s)"
                  extra={
                    <Input.Search
                      placeholder="Search users..."
                      allowClear
                      onSearch={(v) => onSearchNow(v)}
                      onChange={(e) => onSearchNow(e.target.value)}
                      style={{ maxWidth: 260 }}
                    />
                  }
                >
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Space>
                      <Switch checked={bulkMode} onChange={setBulkMode} />
                      <Text>Bulk mode</Text>
                    </Space>

                    <Select
                      showSearch
                      allowClear
                      mode={bulkMode ? "multiple" : undefined}
                      style={{ width: "100%" }}
                      placeholder={
                        bulkMode
                          ? "Select multiple users"
                          : "Search/select user"
                      }
                      options={userOptions}
                      value={bulkMode ? selectedUsers : selectedUser}
                      onChange={(v) => {
                        if (bulkMode) {
                          setSelectedUsers(v || []);
                          if (Array.isArray(v) && v.length === 1)
                            loadUserGrants(v[0]);
                          else setGrants([]);
                        } else {
                          setSelectedUser(v || null);
                          if (v) loadUserGrants(v);
                          else setGrants([]);
                        }
                      }}
                      onSearch={onSearchNow}
                      filterOption={false}
                      notFoundContent={
                        usersLoading ? <Spin size="small" /> : "No users found"
                      }
                    />
                  </Space>

                  <Divider />

                  <Table
                    size="small"
                    pagination={{
                      current: page,
                      pageSize: 10,
                      total,
                      onChange: setPage,
                      showSizeChanger: false,
                    }}
                    loading={usersLoading}
                    dataSource={users}
                    rowKey="_id"
                    columns={[
                      { title: "Name", dataIndex: "fullName" },
                      { title: "Email", dataIndex: "email" },
                      {
                        title: "Role",
                        dataIndex: "role",
                        render: (r) => <RoleTag role={r} />,
                      },
                    ]}
                  />
                </Card>
              </Col>

              {/* Right: grant wizard */}
              <Col xs={24} md={14}>
                <Card
                  style={{ borderRadius: 12, marginBottom: 16 }}
                  title="Grant Division & Screens"
                  extra={
                    <Space wrap>
                      <Button
                        icon={<AppstoreAddOutlined />}
                        onClick={openCreateDivision}
                      >
                        New Division
                      </Button>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={openCreateScreen}
                      >
                        New Screen
                      </Button>
                      <Button
                        icon={<CodeOutlined />}
                        type="primary"
                        ghost
                        onClick={openSchemaStudio}
                      >
                        Schema Studio
                      </Button>
                    </Space>
                  }
                >
                  <Row gutter={[12, 12]}>
                    <Col xs={24}>
                      <Alert
                        type="info"
                        showIcon
                        message="Tip"
                        description={
                          bulkMode
                            ? "Select multiple users and divisions. Screens + operation apply to every user–division pair."
                            : "Select one user and one division, then choose screens."
                        }
                      />
                    </Col>

                    <Col xs={24} lg={8}>
                      <Text strong>Division{bulkMode ? "s" : ""}</Text>
                      <Select
                        style={{ width: "100%", marginTop: 6 }}
                        mode={bulkMode ? "multiple" : undefined}
                        placeholder={
                          bulkMode
                            ? "Select multiple divisions"
                            : "Select division"
                        }
                        options={divisions.map((d) => ({
                          label: `${d.name} (${d.code})`,
                          value: d._id,
                        }))}
                        value={bulkMode ? selectedDivisions : selectedDivision}
                        onChange={(v) => {
                          if (bulkMode) setSelectedDivisions(v || []);
                          else setSelectedDivision(v || null);
                        }}
                        allowClear
                      />
                    </Col>

                    <Col xs={24} lg={10}>
                      <Text strong>Screens</Text>
                      <Select
                        mode="multiple"
                        style={{ width: "100%", marginTop: 6 }}
                        placeholder="Select screens"
                        options={screens.map((s) => ({
                          label: `${s.title} [${s.key}]`,
                          value: s._id,
                        }))}
                        value={selectedScreens}
                        onChange={setSelectedScreens}
                        allowClear
                      />
                    </Col>

                    <Col xs={24} lg={6}>
                      <Text strong>Operation</Text>
                      <Segmented
                        style={{ width: "100%", marginTop: 6 }}
                        value={op}
                        onChange={setOp}
                        options={[
                          { label: "Replace", value: "set" },
                          { label: "Add", value: "add" },
                          { label: "Remove", value: "remove" },
                        ]}
                      />
                    </Col>
                  </Row>

                  <Button
                    type="primary"
                    style={{ marginTop: 12 }}
                    onClick={applyGrants}
                    loading={grantLoading}
                    disabled={
                      (!bulkMode && (!selectedUser || !selectedDivision)) ||
                      (bulkMode &&
                        (selectedUsers.length === 0 ||
                          selectedDivisions.length === 0))
                    }
                    block={isMobile}
                  >
                    {op === "set"
                      ? "Save Access"
                      : op === "add"
                      ? "Add Screens"
                      : "Remove Screens"}
                  </Button>
                </Card>

                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card style={{ borderRadius: 12 }} title="Divisions">
                      <Table
                        size="small"
                        rowKey="_id"
                        dataSource={divisions}
                        pagination={{ pageSize: 5 }}
                        columns={[
                          { title: "Name", dataIndex: "name" },
                          { title: "Code", dataIndex: "code" },
                        ]}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card style={{ borderRadius: 12 }} title="Screens">
                      <Table
                        size="small"
                        rowKey="_id"
                        dataSource={screens}
                        pagination={{ pageSize: 5 }}
                        columns={[
                          { title: "Title", dataIndex: "title" },
                          { title: "Key", dataIndex: "key" },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  style={{ borderRadius: 12, marginTop: 16 }}
                  title="Current Grants"
                >
                  <Table
                    size="small"
                    dataSource={grants}
                    rowKey="_id"
                    columns={[
                      { title: "Division", dataIndex: ["division", "name"] },
                      { title: "Code", dataIndex: ["division", "code"] },
                      {
                        title: "Screens",
                        dataIndex: "screens",
                        render: (arr = []) =>
                          arr.map((s) => s.title).join(", "),
                      },
                    ]}
                  />
                  {bulkMode ? (
                    <Text type="secondary">
                      Select exactly one user to preview their grants here.
                    </Text>
                  ) : !selectedUser ? (
                    <Text type="secondary">
                      Pick a user to view their grants.
                    </Text>
                  ) : null}
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <>
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Space
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <Input.Search
                  placeholder="Search users..."
                  allowClear
                  enterButton
                  onSearch={(v) => onSearchNow(v)}
                  onChange={(e) => onSearchNow(e.target.value)}
                  style={{ minWidth: 260 }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateUser}
                >
                  New User
                </Button>
              </Space>

              <Table
                bordered
                rowKey="_id"
                loading={usersLoading}
                dataSource={users}
                columns={userColumns}
                pagination={{
                  current: page,
                  pageSize: 10,
                  total,
                  onChange: setPage,
                  showSizeChanger: false,
                }}
              />
            </Space>
          </>
        )}
      </Card>

      {/* Change Role Modal */}
      <Modal
        title={`Change Role — ${roleModal.user?.fullName || ""}`}
        open={roleModal.open}
        onCancel={() => setRoleModal({ open: false, user: null, role: null })}
        onOk={changeRole}
        okText="Update"
      >
        <Select
          style={{ width: "100%" }}
          value={roleModal.role}
          onChange={(v) => setRoleModal((m) => ({ ...m, role: v }))}
          options={[
            { label: "Admin", value: "admin" },
            { label: "User", value: "user" },
          ]}
        />
        <Text type="secondary">
          Note: You cannot demote/delete the last superadmin.
        </Text>
      </Modal>

      {/* Create User Modal */}
      <Modal
        title="Create User"
        open={createUserOpen}
        onCancel={() => setCreateUserOpen(false)}
        onOk={createUser}
        okText="Create"
        confirmLoading={creatingUser}
        destroyOnClose
      >
        <Form form={createUserForm} layout="vertical">
          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[{ required: true, message: "Full name is required" }]}
          >
            <Input placeholder="e.g., Priyansh Kumar" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: "Role is required" }]}
            initialValue="user"
          >
            <Select
              options={[
                { label: "User", value: "user" },
                { label: "Admin", value: "admin" },
                { label: "Superadmin", value: "superadmin" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Temporary Password"
            rules={[
              { required: true, message: "Password is required" },
              { len: 8, message: "Password must be exactly 8 characters" },
            ]}
            extra="Share this temporary password with the user; they can change it later."
          >
            <Input.Password placeholder="8 characters" maxLength={8} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        title={`Reset Password — ${pwdModal.user?.fullName || ""}`}
        open={pwdModal.open}
        onCancel={() => setPwdModal({ open: false, user: null })}
        onOk={resetPassword}
        okText="Save"
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Password is required" },
              { len: 8, message: "Password must be exactly 8 characters" },
            ]}
          >
            <Input.Password placeholder="8 characters" maxLength={8} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Division Modal */}
      <Modal
        title="Create Division"
        open={divModalOpen}
        onCancel={() => setDivModalOpen(false)}
        onOk={createDivision}
        okText="Create"
      >
        <Form form={divForm} layout="vertical">
          <Form.Item
            name="name"
            label="Division Name"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g., Sales Division" />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input placeholder="e.g., SALES" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional details..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Screen Modal */}
      <Modal
        title="Create Screen"
        open={screenModalOpen}
        onCancel={() => setScreenModalOpen(false)}
        onOk={createScreen}
        okText="Create"
      >
        <Form form={screenForm} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g., Sales Form" />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input placeholder="e.g., sales_form" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional details..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------------- Schema Studio Drawer (Builder + Advanced) ---------------- */}
      <Drawer
        title={
          <Space>
            <CodeOutlined /> <span>Schema Studio</span>
          </Space>
        }
        placement="right"
        width={isMobile ? "100%" : 980}
        open={schemaOpen}
        onClose={() => setSchemaOpen(false)}
        destroyOnClose={false}
        extra={
          <Space wrap>
            <Segmented
              options={["Builder", "Advanced"]}
              value={builderTab}
              onChange={setBuilderTab}
            />
            {activeVersion ? (
              <Tag color="blue">Active v{activeVersion}</Tag>
            ) : (
              <Tag>no active</Tag>
            )}
            <Button
              icon={<FileSearchOutlined />}
              onClick={loadActiveSchema}
              loading={schemaLoading}
            >
              Load Active
            </Button>
            <Select
              placeholder="Templates"
              style={{ minWidth: 180 }}
              onChange={applyTemplate}
              options={[
                { label: "Blank Object", value: "Blank Object" },
                {
                  label: "Basic Person (name, age, email)",
                  value: "Basic Person (name, age, email)",
                },
              ]}
            />
            <Button icon={<FormatPainterOutlined />} onClick={formatBoth}>
              Format
            </Button>
            <Button icon={<CheckCircleOutlined />} onClick={validateShape}>
              Validate
            </Button>
            <Button
              icon={<SaveOutlined />}
              type="primary"
              onClick={saveNewVersion}
              loading={schemaLoading}
            >
              Save New Version
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Text strong>Division</Text>
              <Select
                showSearch
                style={{ width: "100%", marginTop: 6 }}
                placeholder="Select division"
                options={divisions.map((d) => ({
                  label: `${d.name} (${d.code})`,
                  value: d._id,
                }))}
                value={schemaDivisionId}
                onChange={setSchemaDivisionId}
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24} md={12}>
              <Text strong>Screen</Text>
              <Select
                showSearch
                style={{ width: "100%", marginTop: 6 }}
                placeholder="Select screen"
                options={screens.map((s) => ({
                  label: `${s.title} [${s.key}]`,
                  value: s._id,
                }))}
                value={schemaScreenId}
                onChange={setSchemaScreenId}
                optionFilterProp="label"
              />
            </Col>
          </Row>

          {builderTab === "Builder" ? (
            <>
              <Card size="small" style={{ borderRadius: 12 }}>
                <Row gutter={[12, 12]} align="middle">
                  <Col xs={24} md={10}>
                    <Text strong>Form Title</Text>
                    <Input
                      style={{ marginTop: 6 }}
                      value={formTitle}
                      placeholder="e.g. Sales Entry"
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                  </Col>
                  <Col xs={24} md={14}>
                    <Text strong>Quick Add Fields</Text>
                    <Space wrap style={{ marginTop: 6 }}>
                      {FIELD_TYPES.map((t) => (
                        <Button
                          key={t.value}
                          icon={t.icon}
                          onClick={() => {
                            const key = uniqueKey(
                              t.label,
                              fields.map((f) => f.name)
                            );
                            setFields([
                              ...fields,
                              {
                                name: key,
                                label: t.label,
                                type: t.value,
                                required: false,
                              },
                            ]);
                          }}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </Space>
                  </Col>
                </Row>
              </Card>

              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                {fields.length === 0 && (
                  <Alert
                    type="info"
                    showIcon
                    message="No fields yet"
                    description="Use the Quick Add buttons above to insert fields, then customize them here."
                  />
                )}
                {fields.map((f, idx) => (
                  <FieldCard
                    key={f.name + idx}
                    value={f}
                    onChange={(v) => {
                      const taken = fields
                        .map((x, i) => (i === idx ? null : x.name))
                        .filter(Boolean);
                      let next = { ...v };
                      if (v.name && taken.includes(v.name)) {
                        next.name = uniqueKey(v.name, taken);
                        message.info(
                          `Field key adjusted to "${next.name}" to keep it unique.`
                        );
                      }
                      const copy = fields.slice();
                      copy[idx] = next;
                      setFields(copy);
                    }}
                    onDelete={() =>
                      setFields(fields.filter((_, i) => i !== idx))
                    }
                    onUp={() => {
                      if (idx === 0) return;
                      const copy = fields.slice();
                      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                      setFields(copy);
                    }}
                    onDown={() => {
                      if (idx === fields.length - 1) return;
                      const copy = fields.slice();
                      [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                      setFields(copy);
                    }}
                    isFirst={idx === 0}
                    isLast={idx === fields.length - 1}
                  />
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    const key = uniqueKey(
                      "field",
                      fields.map((f) => f.name)
                    );
                    setFields([
                      ...fields,
                      {
                        name: key,
                        label: "Short Text",
                        type: "string",
                        required: false,
                      },
                    ]);
                  }}
                >
                  Add Another Field
                </Button>
              </Space>
            </>
          ) : (
            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <Card
                  size="small"
                  style={{ borderRadius: 12 }}
                  title={
                    <Space>
                      <CodeOutlined /> <span>JSON Schema</span>
                    </Space>
                  }
                  extra={
                    <Text type="secondary">
                      Define fields in <code>properties</code>
                    </Text>
                  }
                >
                  <Input.TextArea
                    value={schemaText}
                    onChange={(e) => setSchemaText(e.target.value)}
                    autoSize={{ minRows: 14, maxRows: 28 }}
                    spellCheck={false}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  />
                  {!parsedSchema.ok && (
                    <>
                      <Divider />
                      <Alert
                        type="error"
                        showIcon
                        message="Schema JSON error"
                        description={parsedSchema.error}
                      />
                    </>
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card
                  size="small"
                  style={{ borderRadius: 12 }}
                  title={
                    <Space>
                      <CodeOutlined /> <span>UI Schema (optional)</span>
                    </Space>
                  }
                  extra={
                    <Text type="secondary">
                      Widgets/placeholders/layout hints
                    </Text>
                  }
                >
                  <Input.TextArea
                    value={uiSchemaText}
                    onChange={(e) => setUiSchemaText(e.target.value)}
                    autoSize={{ minRows: 14, maxRows: 28 }}
                    spellCheck={false}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  />
                  {!parsedUi.ok && (
                    <>
                      <Divider />
                      <Alert
                        type="error"
                        showIcon
                        message="UI Schema JSON error"
                        description={parsedUi.error}
                      />
                    </>
                  )}
                </Card>
              </Col>
            </Row>
          )}

          {/* Live Preview */}
          <Card
            size="small"
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <PlayCircleOutlined /> <span>Live Preview</span>
              </Space>
            }
            extra={
              <Space>
                <ThunderboltOutlined />
                <Text type="secondary">Renders with current JSON</Text>
              </Space>
            }
          >
            {canPreview ? (
              <div key={previewKey} style={{ maxWidth: 900 }}>
                <DynamicForm
                  schema={parsedSchema.value}
                  uiSchema={parsedUi.value}
                  onSubmit={() =>
                    message.success("Preview submit OK (not saved)")
                  }
                />
              </div>
            ) : (
              <Alert
                type="info"
                message="Provide valid JSON to preview"
                description="Fix JSON errors (or switch to Builder) to enable live preview."
                showIcon
              />
            )}
          </Card>
        </Space>
      </Drawer>
    </div>
  );
}
