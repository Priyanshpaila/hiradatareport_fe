import { useMemo } from "react";
import { Form, Button, Space, Row, Col, Typography, Divider, Tooltip, Card } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import FormField from "./FormField";

const { Text } = Typography;

/**
 * DynamicForm
 * Props:
 *  - formDef: { schema, uiSchema }
 *  - onSubmit(values)
 *  - submitting?: boolean
 *  - title?: string
 */
export default function DynamicForm({ formDef, onSubmit, submitting = false, title }) {
  const [form] = Form.useForm();

  const jsonSchema = formDef?.schema || { type: "object", properties: {} };
  const uiSchema = formDef?.uiSchema || {};
  const props = jsonSchema.properties || {};
  const requiredSet = new Set(jsonSchema.required || []);
  const fields = Object.entries(props);

  // initial values from "default"
  const initialValues = useMemo(
    () =>
      fields.reduce((acc, [name, sch]) => {
        if (sch && "default" in sch) acc[name] = sch.default;
        return acc;
      }, {}),
    [fields]
  );

  // AntD rules from JSON Schema
  const rulesFor = (name, sch) => {
    const rules = [];
    if (requiredSet.has(name)) rules.push({ required: true, message: "Required" });
    if (!sch) return rules;

    if (sch.type === "string") {
      if (sch.minLength != null) rules.push({ min: sch.minLength, message: `Min ${sch.minLength} characters` });
      if (sch.maxLength != null) rules.push({ max: sch.maxLength, message: `Max ${sch.maxLength} characters` });
      if (sch.format === "email") rules.push({ type: "email", message: "Please enter a valid email" });
      if (sch.pattern) {
        try {
          const re = new RegExp(sch.pattern);
          rules.push({ pattern: re, message: sch.patternMessage || "Invalid format" });
        } catch {}
      }
    }
    if (sch.type === "number" || sch.type === "integer") {
      if (typeof sch.minimum === "number") rules.push({ type: "number", min: sch.minimum, message: `Minimum ${sch.minimum}` });
      if (typeof sch.maximum === "number") rules.push({ type: "number", max: sch.maximum, message: `Maximum ${sch.maximum}` });
    }
    return rules;
  };

  const submit = async () => {
    const values = await form.validateFields();
    Object.keys(values).forEach((k) => { if (values[k] === "") values[k] = undefined; });
    onSubmit?.(values);
    form.resetFields();
  };

  // Group by ui:section
  const groups = useMemo(() => {
    const g = {};
    fields.forEach(([name, sch]) => {
      const section = uiSchema?.[name]?.["ui:section"] || "_default";
      if (!g[section]) g[section] = [];
      g[section].push([name, sch]);
    });
    return g;
  }, [fields, uiSchema]);

  const labelWithTooltip = (name, sch) => {
    const label = sch.title || name;
    const tip = uiSchema?.[name]?.["ui:tooltip"];
    if (!tip) return label;
    return (
      <Space size={6}>
        <span>{label}</span>
        <Tooltip title={tip}>
          <InfoCircleOutlined style={{ color: "#999" }} />
        </Tooltip>
      </Space>
    );
  };

  const colSpan = (name) => {
    const uiCol = Number(uiSchema?.[name]?.["ui:col"]);
    // default: 12 on desktop, 24 on small screens
    return Number.isFinite(uiCol) ? uiCol : 12;
  };

  return (
    <Card
      title={title || jsonSchema.title || "Form"}
      styles={{ body: { paddingBottom: 56 } }}
      style={{ borderRadius: 12 }}
    >
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={submit}>
        {Object.entries(groups).map(([section, items], idx) => (
          <div key={section}>
            {section !== "_default" && (
              <>
                {idx !== 0 && <Divider style={{ marginTop: 8 }} />}
                <Text strong style={{ fontSize: 16 }}>{section}</Text>
              </>
            )}
            <Row gutter={[12, 12]} style={{ marginTop: section === "_default" ? 0 : 8 }}>
              {items.map(([name, sch]) => (
                <Col key={name} xs={24} md={colSpan(name)}>
                  <Form.Item
                    name={name}
                    label={labelWithTooltip(name, sch)}
                    rules={rulesFor(name, sch)}
                    extra={uiSchema?.[name]?.["ui:help"]}
                  >
                    <FormField name={name} schema={sch} uiSchema={uiSchema[name]} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </div>
        ))}

        {/* Sticky action bar */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "#fff",
            paddingTop: 8,
            paddingBottom: 8,
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8
          }}
        >
          <Space>
            <Button onClick={() => form.resetFields()}>Reset</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>Submit</Button>
          </Space>
        </div>
      </Form>
    </Card>
  );
}
