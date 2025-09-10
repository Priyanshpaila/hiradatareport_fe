import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DynamicForm from "../components/DynamicForm";
import {
  Card, Row, Col, Select, Button, Typography, Space, message,
  Input, Divider, Alert, Tag, Grid, Table, Modal, Form, Switch,
  InputNumber, Collapse
} from "antd";
import {
  SaveOutlined, PlayCircleOutlined, ThunderboltOutlined, FileSearchOutlined,
  PlusCircleOutlined, EditOutlined, DeleteOutlined,
  ArrowUpOutlined, ArrowDownOutlined, AppstoreOutlined,
  FontSizeOutlined, NumberOutlined, FieldTimeOutlined, MailOutlined,
  CheckCircleOutlined, CodeOutlined
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { Panel } = Collapse;

/* --------------------------- Helper utilities --------------------------- */
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

const pretty = (obj) => JSON.stringify(obj, null, 2);
const tryParse = (txt) => { try { return { ok: true, value: JSON.parse(txt) }; } catch (e) { return { ok: false, error: String(e.message) }; } };

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

/* ---------- Transform between “fields” (visual) and JSON Schema ---------- */
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
      ui[key] = { ...(ui[key] || {}), "ui:widget": "textarea", "ui:options": { rows: 3 } };
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
      schema.properties[key] = { type: "string", format: "email", title: f.label || key };
    } else if (f.type === "date") {
      schema.properties[key] = { type: "string", format: "date", title: f.label || key };
    } else if (f.type === "select") {
      schema.properties[key] = { type: "string", title: f.label || key, enum: (f.options || []).filter(Boolean) };
    }

    if (f.placeholder) {
      ui[key] = { ...(ui[key] || {}), "ui:placeholder": f.placeholder };
    }
    if (f.required) required.push(key);
  }

  if (required.length) schema.required = required;
  return { schema, uiSchema: ui };
}

function parseFieldsFromJson(schema, uiSchema) {
  const fields = [];
  if (!schema || schema.type !== "object" || !schema.properties) return fields;

  for (const [name, def] of Object.entries(schema.properties)) {
    const isReq = Array.isArray(schema.required) && schema.required.includes(name);
    const ui = uiSchema?.[name] || {};

    let type = "string";
    let options;
    let min, max;

    if (def.type === "string") {
      if (def.format === "email") type = "email";
      else if (def.format === "date") type = "date";
      else if (Array.isArray(def.enum)) { type = "select"; options = def.enum.slice(); }
      else if (ui["ui:widget"] === "textarea") type = "text";
      else type = "string";
    } else if (def.type === "number") { type = "number"; min = def.minimum; max = def.maximum; }
    else if (def.type === "integer") { type = "integer"; min = def.minimum; max = def.maximum; }
    else if (def.type === "boolean") { type = "boolean"; }

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

/* ----------------------------- Field Card ------------------------------ */
function FieldCard({ value, onChange, onDelete, onUp, onDown, isFirst, isLast }) {
  const { label, name, type, required, placeholder, options = [], min, max } = value;

  return (
    <Card
      size="small"
      style={{ borderRadius: 10 }}
      bodyStyle={{ paddingTop: 12, paddingBottom: 12 }}
      extra={
        <Space>
          <Button size="small" icon={<ArrowUpOutlined />} disabled={isFirst} onClick={onUp} />
          <Button size="small" icon={<ArrowDownOutlined />} disabled={isLast} onClick={onDown} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
        </Space>
      }
      title={
        <Space wrap>
          <Text strong>{label || "Untitled field"}</Text>
          <Tag>{name || "key"}</Tag>
          <Tag color="blue">{FIELD_TYPES.find(t => t.value === type)?.label || type}</Tag>
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
            addonAfter={<Button size="small" onClick={() => onChange({ ...value, name: slug(label || "field") })}>Auto</Button>}
          />
        </Col>
        <Col xs={24} md={6}>
          <Text type="secondary">Type</Text>
          <Select
            style={{ width: "100%" }}
            value={type}
            onChange={(v) => onChange({ ...value, type: v, options: v === "select" ? options : undefined })}
            options={FIELD_TYPES.map(t => ({ label: (<Space>{t.icon}{t.label}</Space>), value: t.value }))}
          />
        </Col>
      </Row>

      <Row gutter={8}>
        <Col xs={24} md={10}>
          <Text type="secondary">Placeholder</Text>
          <Input
            value={placeholder}
            onChange={(e) => onChange({ ...value, placeholder: e.target.value })}
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
                onChange={(v) => onChange({ ...value, min: typeof v === "number" ? v : undefined })}
              />
            </Col>
            <Col xs={12} md={7}>
              <Text type="secondary">Max</Text>
              <InputNumber
                style={{ width: "100%" }}
                value={typeof max === "number" ? max : undefined}
                onChange={(v) => onChange({ ...value, max: typeof v === "number" ? v : undefined })}
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
              onChange={(vals) => onChange({ ...value, options: vals.filter(Boolean) })}
              placeholder="Type an option and press Enter"
            />
          </Col>
        )}

        <Col xs={24} md={4} style={{ display: "flex", alignItems: "flex-end" }}>
          <Space>
            <Text type="secondary">Required</Text>
            <Switch checked={!!required} onChange={(v) => onChange({ ...value, required: v })} />
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

/* -------------------------------- Page --------------------------------- */
export default function SchemaStudio() {
  const bp = useBreakpoint();
  const isMobile = !bp.md;

  // Meta selection
  const [divisions, setDivisions] = useState([]);
  const [screens, setScreens] = useState([]);
  const [divisionId, setDivisionId] = useState(null);
  const [screenId, setScreenId] = useState(null);

  // Builder state
  const [formTitle, setFormTitle] = useState(DEFAULT_FORM_TITLE);
  const [fields, setFields] = useState([]);

  // Advanced JSON (hidden under Collapse)
  const [schemaText, setSchemaText] = useState(pretty({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    title: DEFAULT_FORM_TITLE,
    properties: {}
  }));
  const [uiSchemaText, setUiSchemaText] = useState(pretty({}));

  const [activeVersion, setActiveVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Load meta
  useEffect(() => {
    api.get("/meta/divisions").then(({ data }) => setDivisions(data || []));
    api.get("/meta/screens").then(({ data }) => setScreens(data || []));
  }, []);

  const divisionOptions = useMemo(() =>
    divisions.map(d => ({ label: `${d.name} (${d.code})`, value: d._id })), [divisions]);

  const screenOptions = useMemo(() =>
    screens.map(s => ({ label: `${s.title} [${s.key}]`, value: s._id })), [screens]);

  /* ------------------------ Sync builder → JSON ------------------------ */
  const syncJson = () => {
    const { schema, uiSchema } = buildJsonFromFields(fields, formTitle);
    setSchemaText(pretty(schema));
    setUiSchemaText(pretty(uiSchema));
    setPreviewKey(k => k + 1);
  };
  useEffect(() => { syncJson(); /* eslint-disable-next-line */ }, [fields, formTitle]);

  /* ------------------------ Load active from API ----------------------- */
  const loadActive = async () => {
    if (!divisionId || !screenId) return message.error("Select division & screen");
    setLoading(true);
    try {
      const { data } = await api.get(`/meta/form-definitions/${divisionId}/${screenId}`);
      if (!data) {
        message.info("No active form definition for this screen");
        setActiveVersion(null);
        return;
      }
      setSchemaText(pretty(data.schema || {}));
      setUiSchemaText(pretty(data.uiSchema || {}));

      const parsed = parseFieldsFromJson(data.schema, data.uiSchema);
      setFields(parsed);
      setFormTitle(data.schema?.title || DEFAULT_FORM_TITLE);
      setActiveVersion(data.version || null);
      setPreviewKey(k => k + 1);
      message.success(`Loaded active schema (v${data.version})`);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load schema");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------- Save -------------------------------- */
  const saveVersion = async () => {
    if (!divisionId || !screenId) return message.error("Select division & screen");
    // ensure JSON is synced
    const s = tryParse(schemaText);
    const u = tryParse(uiSchemaText);
    if (!s.ok) return message.error(`Schema JSON error: ${s.error}`);
    if (!u.ok) return message.error(`UI Schema JSON error: ${u.error}`);

    setLoading(true);
    try {
      const { data } = await api.post("/meta/form-definitions", {
        divisionId, screenId, schema: s.value, uiSchema: u.value
      });
      setActiveVersion(data.version);
      message.success(`Saved new version v${data.version} (now active)`);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to save definition");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------- Quick add ------------------------------ */
  const quickAdd = (type) => {
    const label = FIELD_TYPES.find(t => t.value === type)?.label || "Field";
    const key = uniqueKey(label, fields.map(f => f.name));
    setFields([...fields, { name: key, label, type, required: false }]);
  };

  /* ----------------------------- Render -------------------------------- */
  const parsedSchema = tryParse(schemaText);
  const parsedUi = tryParse(uiSchemaText);
  const canPreview = parsedSchema.ok && parsedUi.ok;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card
        style={{ borderRadius: 12 }}
        title={<Title level={4} style={{ margin: 0 }}>Schema Studio</Title>}
        extra={
          <Space wrap>
            <Select
              placeholder="Division"
              style={{ minWidth: 220 }}
              options={divisionOptions}
              value={divisionId}
              onChange={setDivisionId}
              showSearch
              optionFilterProp="label"
            />
            <Select
              placeholder="Screen"
              style={{ minWidth: 220 }}
              options={screenOptions}
              value={screenId}
              onChange={setScreenId}
              showSearch
              optionFilterProp="label"
            />
            {activeVersion ? <Tag color="blue">Active v{activeVersion}</Tag> : <Tag>no active</Tag>}
            <Button icon={<FileSearchOutlined />} onClick={loadActive} loading={loading}>
              Load Active
            </Button>
            <Button icon={<SaveOutlined />} type="primary" onClick={saveVersion} loading={loading}>
              Save New Version
            </Button>
          </Space>
        }
      >
        {/* Title + quick add */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }} size="small">
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
                {FIELD_TYPES.map(t => (
                  <Button key={t.value} icon={t.icon} onClick={() => quickAdd(t.value)}>
                    {t.label}
                  </Button>
                ))}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Fields list */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
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
                    // keep keys unique
                    const taken = fields.map((x, i) => i === idx ? null : x.name).filter(Boolean);
                    let next = { ...v };
                    if (v.name && taken.includes(v.name)) {
                      next.name = uniqueKey(v.name, taken);
                      message.info(`Field key adjusted to "${next.name}" to keep it unique.`);
                    }
                    const copy = fields.slice();
                    copy[idx] = next;
                    setFields(copy);
                  }}
                  onDelete={() => setFields(fields.filter((_, i) => i !== idx))}
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
                onClick={() => quickAdd("string")}
              >
                Add Another Field
              </Button>
            </Space>
          </Col>

          {/* Live preview */}
          <Col xs={24} lg={12}>
            <Card
              style={{ borderRadius: 12 }}
              title={<Space><PlayCircleOutlined /> <span>Live Preview</span></Space>}
              extra={<Space><ThunderboltOutlined /><Text type="secondary">Interactive demo</Text></Space>}
            >
              {canPreview ? (
                <div key={previewKey} style={{ maxWidth: 900 }}>
                  <DynamicForm
                    schema={parsedSchema.value}
                    uiSchema={parsedUi.value}
                    onSubmit={() => message.success("Preview submit OK (not saved)")}
                  />
                </div>
              ) : (
                <Alert
                  type="info"
                  message="Preview unavailable"
                  description="Fix JSON in Advanced section (below) — it syncs automatically from your fields."
                  showIcon
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* Advanced JSON (optional) */}
        <Collapse style={{ marginTop: 16 }}>
          <Panel header={<Space><CodeOutlined /> <span>Advanced (JSON) — optional</span></Space>} key="1">
            <Alert
              type="warning"
              showIcon
              message="Only for power users"
              description="This JSON is generated from your inputs. You can edit it directly if needed."
              style={{ marginBottom: 12 }}
            />
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card size="small" title="JSON Schema">
                  <Input.TextArea
                    value={schemaText}
                    onChange={(e) => setSchemaText(e.target.value)}
                    autoSize={{ minRows: 14, maxRows: 26 }}
                    spellCheck={false}
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="UI Schema (widgets/placeholders)">
                  <Input.TextArea
                    value={uiSchemaText}
                    onChange={(e) => setUiSchemaText(e.target.value)}
                    autoSize={{ minRows: 14, maxRows: 26 }}
                    spellCheck={false}
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                  />
                </Card>
              </Col>
            </Row>
          </Panel>
        </Collapse>
      </Card>
    </div>
  );
}
