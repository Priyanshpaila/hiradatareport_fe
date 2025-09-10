import { useEffect, useMemo, useState } from "react";
import { Card, Space, Select, Segmented, Spin, Empty, Typography, Row, Col, Button, Tooltip as AntdTooltip, message, Divider } from "antd";
import { DownloadOutlined, AreaChartOutlined, LineChartOutlined, BarChartOutlined, ReloadOutlined } from "@ant-design/icons";
import { api } from "../api";
import dayjs from "dayjs";
import ExportA3Button from "../components/ExportA3Button";

import {
  ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine
} from "recharts";

const { Text, Title } = Typography;

/* ------------------------------ helpers ------------------------------- */
function toCSV(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","));
  return [headers.join(","), ...body].join("\n");
}

function downloadCSV(rows, filename = "chart-data.csv") {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function movingAverage(data, key = "total", window = 3) {
  if (!Array.isArray(data) || !data.length) return [];
  const vals = data.map(d => d[key] ?? 0);
  const out = data.map((d, i) => {
    const s = Math.max(0, i - (window - 1));
    const slice = vals.slice(s, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    return { ...d, ma: Number(avg.toFixed(2)) };
  });
  return out;
}

function computeKPIs(rows) {
  if (!rows?.length) return { last: 0, prev: 0, mom: 0, sum12: 0 };
  const last = rows[rows.length - 1]?.total ?? 0;
  const prev = rows[rows.length - 2]?.total ?? 0;
  const mom = prev ? ((last - prev) / prev) * 100 : 0;
  const sum12 = rows.reduce((a, b) => a + (b.total ?? 0), 0);
  return {
    last: Number(last.toFixed(2)),
    prev: Number(prev.toFixed(2)),
    mom: Number(mom.toFixed(1)),
    sum12: Number(sum12.toFixed(2))
  };
}

/* ------------------------------- page --------------------------------- */
export default function Charts() {
  const [grants, setGrants] = useState([]);
  const [sel, setSel] = useState(null); // { divisionId, screenId }
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // schema-derived numeric fields
  const [numFields, setNumFields] = useState([]);
  const [field, setField] = useState(null);

  // controls
  const [months, setMonths] = useState(12);
  const [chartType, setChartType] = useState("line"); // line | area | bar
  const [smooth, setSmooth] = useState(false);
  const [agg, setAgg] = useState("sum"); // sum | avg (if your backend supports avg-by-month)

  // access -> options for division/screen
  useEffect(() => {
    api.get("/access/my-access").then(({ data }) => setGrants(Array.isArray(data) ? data : []));
  }, []);

  const options = useMemo(() => {
    return grants.flatMap(g => (g.screens || []).map(s => ({
      label: `${g.division?.name || "Division"} → ${s.title}`,
      value: `${g.division?._id}|${s._id}`,
      division: g.division,
      screen: s,
    })));
  }, [grants]);

  // when screen changes -> fetch numeric fields from schema
  const fetchNumericFields = async (divisionId, screenId) => {
    try {
      const { data } = await api.get(`/forms/${divisionId}/${screenId}/schema`);
      const props = data?.schema?.properties || {};
      const nums = Object.entries(props)
        .filter(([, sch]) => sch?.type === "number" || sch?.type === "integer")
        .map(([name, sch]) => ({ label: sch?.title || name, value: name }));
      setNumFields(nums);
      // Default: pick "amount" if exists, else first numeric field
      const maybeAmount = nums.find(f => f.value.toLowerCase() === "amount");
      setField(prev => prev && nums.some(n => n.value === prev) ? prev : (maybeAmount?.value || nums[0]?.value || null));
    } catch (e) {
      setNumFields([]);
      setField(null);
    }
  };

  // fetch data
  const fetchData = async () => {
    if (!sel || !field) return;
    setLoading(true);
    try {
      // Prefer sum-by-month; if you enable avg, expose /avg-by-month similarly
      const path = agg === "sum" ? "sum-by-month" : `${agg}-by-month`;
      const { data } = await api.get(`/analytics/${sel.divisionId}/${sel.screenId}/${path}`, {
        params: { field, months }
      });
      // Expected shape: [{ month: "2025-01", total: 123 }]
      const mapped = (data || []).map(r => ({
        monthLabel: dayjs(r.month + "-01").format("MMM YYYY"),
        month: r.month,
        total: Number(r.total ?? 0)
      }));
      setRows(mapped);
    } catch (e) {
      // If avg endpoint doesn't exist, fallback to sum gracefully
      if (agg !== "sum") {
        message.warning("Average endpoint not found. Falling back to SUM.");
        setAgg("sum");
      } else {
        message.error(e.response?.data?.message || "Failed to load analytics");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Load fields when selection changes
  useEffect(() => {
    if (sel) fetchNumericFields(sel.divisionId, sel.screenId);
  }, [sel]);

  // Load data when dependencies change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, field, months, agg]);

  const kpis = useMemo(() => computeKPIs(rows), [rows]);
  const series = useMemo(() => (smooth ? movingAverage(rows, "total", 3) : rows), [rows, smooth]);

  const ChartBody = () => {
    if (!rows.length) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;
    }

    const common = (
      <>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="monthLabel" />
        <YAxis />
        <Tooltip />
        <Legend />
        <ReferenceLine y={0} stroke="#bbb" />
      </>
    );

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={series}>
            {common}
            <Bar dataKey="total" name="Total" />
            {smooth && <Line type="monotone" dataKey="ma" name="3-mo Avg" strokeDasharray="4 2" dot={false} />}
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={series}>
            {common}
            <Area type="monotone" dataKey="total" name="Total" />
            {smooth && <Line type="monotone" dataKey="ma" name="3-mo Avg" strokeDasharray="4 2" dot={false} />}
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    // default line
    return (
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={series}>
          {common}
          <Line type="monotone" dataKey="total" name="Total" dot={false} />
          {smooth && <Line type="monotone" dataKey="ma" name="3-mo Avg" strokeDasharray="4 2" dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ minWidth: 380 }}
          placeholder="Choose Division/Screen"
          options={options}
          onChange={v => {
            const [divisionId, screenId] = v.split("|");
            setSel({ divisionId, screenId });
          }}
          showSearch
          optionFilterProp="label"
        />

        <Select
          style={{ minWidth: 180 }}
          placeholder="Metric (numeric field)"
          value={field}
          options={numFields}
          onChange={setField}
          disabled={!sel || !numFields.length}
        />

        <Segmented
          options={[
            { label: "6m", value: 6 },
            { label: "12m", value: 12 },
            { label: "24m", value: 24 },
          ]}
          value={months}
          onChange={setMonths}
        />

        <Segmented
          options={[
            { label: <AntdTooltip title="Line"><LineChartOutlined /></AntdTooltip>, value: "line" },
            { label: <AntdTooltip title="Area"><AreaChartOutlined /></AntdTooltip>, value: "area" },
            { label: <AntdTooltip title="Bar"><BarChartOutlined /></AntdTooltip>, value: "bar" },
          ]}
          value={chartType}
          onChange={setChartType}
        />

        <Segmented
          options={[
            { label: "Sum", value: "sum" },
            { label: "Avg", value: "avg" }, // requires /avg-by-month backend; will fallback if missing
          ]}
          value={agg}
          onChange={setAgg}
        />

        <Segmented
          options={[
            { label: "Raw", value: false },
            { label: "Smooth (3-mo)", value: true },
          ]}
          value={smooth}
          onChange={setSmooth}
        />

        <Button icon={<ReloadOutlined />} onClick={fetchData} />

        <ExportA3Button targetId="charts-root" fileName="visualization-a3.pdf" />

        <Button
          icon={<DownloadOutlined />}
          onClick={() => downloadCSV(rows, `chart-${field || "metric"}-${months}m.csv`)}
          disabled={!rows.length}
        >
          CSV
        </Button>
      </Space>

      <div id="charts-root" style={{ display: "grid", gap: 16 }}>
        {/* KPIs */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
              <Title level={5} style={{ margin: 0 }}>Last Month</Title>
              <Text style={{ fontSize: 24, fontWeight: 700 }}>{kpis.last}</Text>
              <div><Text type="secondary">{rows.at(-1)?.monthLabel || "—"}</Text></div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
              <Title level={5} style={{ margin: 0 }}>MoM Change</Title>
              <Text style={{ fontSize: 24, fontWeight: 700 }}>
                {kpis.mom > 0 ? `+${kpis.mom}%` : `${kpis.mom}%`}
              </Text>
              <div><Text type="secondary">vs previous month</Text></div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
              <Title level={5} style={{ margin: 0 }}>Total (period)</Title>
              <Text style={{ fontSize: 24, fontWeight: 700 }}>{kpis.sum12}</Text>
              <div><Text type="secondary">last {months} months</Text></div>
            </Card>
          </Col>
        </Row>

        {/* Chart */}
        <Card style={{ borderRadius: 12 }} title={`Total by Month — ${field || "metric"}`}>
          {loading ? <Spin /> : <ChartBody />}
        </Card>

        {/* Secondary view (same data, different presentation) */}
        <Card style={{ borderRadius: 12 }} title="Table (download-ready)">
          {rows.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Month</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Total</th>
                    {smooth && <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>3-mo Avg</th>}
                  </tr>
                </thead>
                <tbody>
                  {series.map(r => (
                    <tr key={r.month}>
                      <td style={{ padding: 8, borderBottom: "1px solid #fafafa" }}>{r.monthLabel}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid #fafafa", textAlign: "right" }}>{r.total}</td>
                      {smooth && <td style={{ padding: 8, borderBottom: "1px solid #fafafa", textAlign: "right" }}>{r.ma}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Divider style={{ margin: "12px 0" }} />
              <Space>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadCSV(rows, `chart-${field || "metric"}-${months}m.csv`)}
                >
                  Download CSV
                </Button>
                <Text type="secondary">Perfect for Excel or further analysis.</Text>
              </Space>
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
          )}
        </Card>
      </div>
    </div>
  );
}
