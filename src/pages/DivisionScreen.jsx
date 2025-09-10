import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Card, message, Skeleton, Space, Tag, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import DynamicForm from "../components/DynamicForm";
import RecentSubmissions from "../components/RecentSubmissions";

export default function DivisionScreen() {
  const { divisionId, screenId } = useParams();
  const [formDef, setFormDef] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/forms/${divisionId}/${screenId}/schema`);
      setFormDef(data);
      const { data: list } = await api.get(`/forms/${divisionId}/${screenId}/submissions`);
      setSubs(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [divisionId, screenId]);

  const onSubmit = async (values) => {
    try {
      setSaving(true);
      await api.post(`/forms/${divisionId}/${screenId}/submit`, values);
      message.success("Saved");
      await load();
    } catch (e) {
      message.error(e.response?.data?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formDef) {
    return (
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Card title="Loading form…" style={{ borderRadius: 12 }}>
          <Skeleton active />
        </Card>
        <Card title="Recent Submissions" style={{ borderRadius: 12 }}>
          <Skeleton active />
        </Card>
      </Space>
    );
  }

  const title =
    formDef?.screen?.title ||
    formDef?.schema?.title ||
    "Form";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card
        style={{ borderRadius: 12 }}
        title={
          <Space align="center">
            <span>{title}</span>
            {formDef?.version ? <Tag color="blue">v{formDef.version}</Tag> : null}
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
        }
      >
        <DynamicForm formDef={formDef} onSubmit={onSubmit} submitting={saving} />
      </Card>

      <RecentSubmissions submissions={subs} schema={formDef?.schema} />
    </div>
  );
}
