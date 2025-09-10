// src/pages/DivisionScreen.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Card, message, Skeleton, Space, Tag, Button, Typography, Alert } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import DynamicForm from "../components/DynamicForm";
import RecentSubmissions from "../components/RecentSubmissions";

const { Text } = Typography;
const isHex24 = (s = "") => /^[0-9a-fA-F]{24}$/.test(String(s));
const norm = (s = "") => String(s).trim().toLowerCase();

export default function DivisionScreen() {
  // Friendly (preferred) or legacy params
  const params = useParams();
  const divisionParam = decodeURIComponent(params.divisionCode ?? params.divisionId ?? "");
  const screenParam   = decodeURIComponent(params.screenKey   ?? params.screenId   ?? "");

  const [meta, setMeta] = useState({
    divisionId: null,
    screenId: null,
    divisionName: "",
    divisionCode: "",
    screenTitle: "",
    screenKey: "",
  });

  const [formDef, setFormDef] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // 1) Resolve :division / :screen to IDs + nice labels
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        setLoadingMeta(true);

        const [{ data: divisions }, { data: screens }] = await Promise.all([
          api.get("/meta/divisions"),
          api.get("/meta/screens"),
        ]);

        const dNeedle = norm(divisionParam);
        const sNeedle = norm(screenParam);

        // Try as raw ObjectIds first
        let d = isHex24(divisionParam)
          ? (divisions || []).find((x) => String(x._id) === String(divisionParam))
          : null;

        let s = isHex24(screenParam)
          ? (screens || []).find((x) => String(x._id) === String(screenParam))
          : null;

        // Fallbacks: by code OR name for division; by key OR title for screen
        if (!d) {
          d = (divisions || []).find(
            (x) => norm(x.code) === dNeedle || norm(x.name) === dNeedle
          );
        }
        if (!s) {
          s = (screens || []).find(
            (x) => norm(x.key) === sNeedle || norm(x.title) === sNeedle
          );
        }

        if (!d) throw new Error(`Division not found`);
        if (!s) throw new Error(`Screen not found`);

        if (cancelled) return;
        setMeta({
          divisionId: String(d._id),
          screenId: String(s._id),
          divisionName: d.name,
          divisionCode: d.code,
          screenTitle: s.title,
          screenKey: s.key,
        });
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to resolve route");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [divisionParam, screenParam]);

  // 2) Load schema + submissions
  const loadData = async () => {
    if (!meta.divisionId || !meta.screenId) return;
    try {
      setLoadingData(true);
      const [{ data: schemaDef }, { data: list }] = await Promise.all([
        api.get(`/forms/${meta.divisionId}/${meta.screenId}/schema`),
        api.get(`/forms/${meta.divisionId}/${meta.screenId}/submissions`),
      ]);
      setFormDef(schemaDef);
      setSubs(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.divisionId, meta.screenId]);

  // 3) Submit handler
  const onSubmit = async (values) => {
    try {
      setSaving(true);
      await api.post(`/forms/${meta.divisionId}/${meta.screenId}/submit`, values);
      message.success("Saved");
      await loadData();
    } catch (e) {
      message.error(e.response?.data?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // UI states
  if (loadingMeta) {
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

  if (err) {
    return (
      <Alert
        type="error"
        showIcon
        message="Invalid link"
        description={err}
        style={{ borderRadius: 12 }}
      />
    );
  }

  const title =
    formDef?.screen?.title ||
    formDef?.schema?.title ||
    meta.screenTitle ||
    "Form";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card
        style={{ borderRadius: 12 }}
        title={
          <Space wrap align="center">
            <span>{title}</span>
            {formDef?.version ? <Tag color="blue">v{formDef.version}</Tag> : null}
            <Tag>
              Division: <b style={{ marginLeft: 6 }}>{meta.divisionName}</b>
            </Tag>
            <Tag color="geekblue">{meta.divisionCode}</Tag>
            <Tag>
              Screen: <b style={{ marginLeft: 6 }}>{meta.screenTitle}</b>
            </Tag>
            <Tag color="purple">{meta.screenKey}</Tag>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
        }
      >
        {loadingData ? (
          <Skeleton active />
        ) : (
          <DynamicForm formDef={formDef} onSubmit={onSubmit} submitting={saving} />
        )}
        {!loadingData && !formDef ? (
          <Text type="secondary">No active schema for this screen.</Text>
        ) : null}
      </Card>

      <RecentSubmissions submissions={subs} schema={formDef?.schema} />
    </div>
  );
}
