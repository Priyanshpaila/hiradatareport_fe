import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Space,
  Select,
  Segmented,
  Spin,
  Empty,
  Typography,
  Row,
  Col,
  Button,
  Tooltip as AntdTooltip,
  message,
  Divider,
  Alert,
} from "antd";
import {
  DownloadOutlined,
  AreaChartOutlined,
  LineChartOutlined,
  BarChartOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { api } from "../api";
import dayjs from "dayjs";
import ExportA3Button from "../components/ExportA3Button";
import logo from "../assets/logo.png";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

const { Text, Title } = Typography;

/* ------------------------------ helpers ------------------------------- */
function toCSV(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
  );
  return [headers.join(","), ...body].join("\n");
}

function downloadCSV(rows, filename = "chart-data.csv") {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function computeKPIsFromCombined(rows) {
  if (!rows?.length) return { last: 0, prev: 0, mom: 0, sum: 0 };
  const last = rows[rows.length - 1]?.total ?? 0;
  const prev = rows[rows.length - 2]?.total ?? 0;
  const mom = prev ? ((last - prev) / prev) * 100 : 0;
  const sum = rows.reduce((a, b) => a + (b.total ?? 0), 0);
  return {
    last: Number(last.toFixed(2)),
    prev: Number(prev.toFixed(2)),
    mom: Number(mom.toFixed(1)),
    sum: Number(sum.toFixed(2)),
  };
}

// simple palette for series; falls back to Recharts defaults if you omit
const PALETTE = [
  "#5B8FF9",
  "#61DDAA",
  "#65789B",
  "#F6BD16",
  "#7262fd",
  "#78D3F8",
  "#FF99C3",
  "#F6903D",
  "#955FE5",
  "#3CCBDA",
];

/* ------------------------------- page --------------------------------- */
export default function Charts() {
  const [grants, setGrants] = useState([]);
  const [sel, setSel] = useState(null); // { divisionId, screenId }
  const [selNames, setSelNames] = useState({ division: "", screen: "" });
  const [loading, setLoading] = useState(false);

  // numeric fields from schema
  const [numFields, setNumFields] = useState([]); // [{label, value}]
  // multi-series rows: [{month, monthLabel, <field1>, <field2>, ..., total}]
  const [rows, setRows] = useState([]);

  // controls
  const [months, setMonths] = useState(12);
  const [chartType, setChartType] = useState("line"); // line | area | bar

  // access -> options for division/screen
  useEffect(() => {
    api
      .get("/access/my-access")
      .then(({ data }) => setGrants(Array.isArray(data) ? data : []));
  }, []);

  const options = useMemo(() => {
    return grants.flatMap((g) =>
      (g.screens || []).map((s) => ({
        label: `${g.division?.name || "Division"} → ${s.title}`,
        value: `${g.division?._id}|${s._id}`,
        division: g.division,
        screen: s,
      }))
    );
  }, [grants]);

  // 1) fetch numeric fields from schema
  const fetchNumericFields = async (divisionId, screenId) => {
    try {
      const { data } = await api.get(`/forms/${divisionId}/${screenId}/schema`);
      const props = data?.schema?.properties || {};
      const nums = Object.entries(props)
        .filter(([, sch]) => sch?.type === "number" || sch?.type === "integer")
        .map(([name, sch]) => ({ label: sch?.title || name, value: name }));
      setNumFields(nums);
      return nums;
    } catch (e) {
      setNumFields([]);
      return [];
    }
  };

  // 2) fetch analytics for *each* numeric field, then merge by month
  const fetchAllSeries = async (divisionId, screenId, monthsArg, fieldsList) => {
    if (!fieldsList.length) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      // call /sum-by-month for each field concurrently
      const promises = fieldsList.map((f) =>
        api.get(`/analytics/${divisionId}/${screenId}/sum-by-month`, {
          params: { field: f.value, months: monthsArg },
        })
      );
      const results = await Promise.all(promises);

      // build a month index (YYYY-MM sorted)
      const monthSet = new Set();
      results.forEach(({ data }) => {
        (data || []).forEach((r) => monthSet.add(r.month));
      });
      const monthKeys = Array.from(monthSet).sort(); // ascending

      // assemble rows
      const merged = monthKeys.map((m) => {
        const monthLabel = dayjs(m + "-01").format("MMM YYYY");
        const row = { month: m, monthLabel };
        let total = 0;
        // fill each field
        results.forEach((res, idx) => {
          const fieldKey = fieldsList[idx].value;
          const val =
            (res.data || []).find((r) => r.month === m)?.total ?? 0;
          row[fieldKey] = Number(val) || 0;
          total += Number(val) || 0;
        });
        row.total = Number(total.toFixed(2));
        return row;
      });

      setRows(merged);
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.message || "Failed to load analytics");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // when a selection is made, load schema fields then data
  useEffect(() => {
    (async () => {
      if (!sel) return;
      const fields = await fetchNumericFields(sel.divisionId, sel.screenId);
      await fetchAllSeries(sel.divisionId, sel.screenId, months, fields);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // refetch when months changes (and we already know fields)
  useEffect(() => {
    if (!sel || !numFields.length) return;
    fetchAllSeries(sel.divisionId, sel.screenId, months, numFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const kpis = useMemo(() => computeKPIsFromCombined(rows), [rows]);

  /* ---------------------------- chart ---------------------------- */
  const ChartBody = () => {
    if (loading) return <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>;
    if (!rows.length) {
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
        </div>
      );
    }
    if (!numFields.length) {
      return (
        <div style={{ padding: 24 }}>
          <Alert
            type="info"
            showIcon
            message="No numeric fields found"
            description="This form has no numeric fields to visualize."
          />
        </div>
      );
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
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={rows}>
            {common}
            {numFields.map((f, i) => (
              <Bar key={f.value} dataKey={f.value} name={f.label} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={rows}>
            {common}
            {numFields.map((f, i) => (
              <Area
                key={f.value}
                type="monotone"
                dataKey={f.value}
                name={f.label}
                fill={PALETTE[i % PALETTE.length]}
                stroke={PALETTE[i % PALETTE.length]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    // default line
    return (
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={rows}>
          {common}
          {numFields.map((f, i) => (
            <Line
              key={f.value}
              type="monotone"
              dataKey={f.value}
              name={f.label}
              stroke={PALETTE[i % PALETTE.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  /* ---------------------------- table ---------------------------- */
  const TableBlock = () => {
    if (!rows.length) {
      return (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
      );
    }
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>
                Month
              </th>
              {numFields.map((f) => (
                <th key={f.value} style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>
                  {f.label}
                </th>
              ))}
              <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td style={{ padding: 8, borderBottom: "1px solid #fafafa" }}>{r.monthLabel}</td>
                {numFields.map((f) => (
                  <td key={f.value} style={{ padding: 8, borderBottom: "1px solid #fafafa", textAlign: "right" }}>
                    {r[f.value] ?? 0}
                  </td>
                ))}
                <td style={{ padding: 8, borderBottom: "1px solid #fafafa", textAlign: "right" }}>
                  {r.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Divider style={{ margin: "12px 0" }} />
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadCSV(rows, `chart-all-fields-${months}m.csv`)}
          >
            Download CSV
          </Button>
          <Text type="secondary">Perfect for Excel or deeper analysis.</Text>
        </Space>
      </div>
    );
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ minWidth: 380 }}
          placeholder="Choose Division/Screen"
          options={options}
          value={sel ? `${sel.divisionId}|${sel.screenId}` : undefined}
          onChange={(v, option) => {
            const [divisionId, screenId] = String(v).split("|");
            setSel({ divisionId, screenId });
            setSelNames({
              division: option?.division?.name || "",
              screen: option?.screen?.title || "",
            });
          }}
          showSearch
          optionFilterProp="label"
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
            {
              label: (
                <AntdTooltip title="Line">
                  <LineChartOutlined />
                </AntdTooltip>
              ),
              value: "line",
            },
            {
              label: (
                <AntdTooltip title="Area">
                  <AreaChartOutlined />
                </AntdTooltip>
              ),
              value: "area",
            },
            {
              label: (
                <AntdTooltip title="Bar">
                  <BarChartOutlined />
                </AntdTooltip>
              ),
              value: "bar",
            },
          ]}
          value={chartType}
          onChange={setChartType}
        />

        <Button icon={<ReloadOutlined />} onClick={() => sel && fetchAllSeries(sel.divisionId, sel.screenId, months, numFields)} />

        <ExportA3Button
          targetId="charts-root"
          fileName="visualization-a3.pdf"
          title="Division Analytics — All Metrics"
          logoSrc={logo}
          meta={{
            Division: selNames.division || "—",
            Screen: selNames.screen || "—",
            Period: `Last ${months} months`,
            Metrics: numFields.length ? `${numFields.length} numeric field(s)` : "—",
          }}
        />
      </Space>

      <div id="charts-root" style={{ display: "grid", gap: 16 }}>
        {/* KPIs (combined across fields) */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
              <Title level={5} style={{ margin: 0 }}>Last Month (All)</Title>
              <Text style={{ fontSize: 24, fontWeight: 700 }}>{kpis.last}</Text>
              <div><Text type="secondary">{rows.at(-1)?.monthLabel || "—"}</Text></div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
              <Title level={5} style={{ margin: 0 }}>MoM Change (All)</Title>
              <Text style={{ fontSize: 24, fontWeight: 700 }}>
                {kpis.mom > 0 ? `+${kpis.mom}%` : `${kpis.mom}%`}
              </Text>
              <div><Text type="secondary">vs previous month</Text></div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
              <Title level={5} style={{ margin: 0 }}>Total (period, All)</Title>
              <Text style={{ fontSize: 24, fontWeight: 700 }}>{kpis.sum}</Text>
              <div><Text type="secondary">last {months} months</Text></div>
            </Card>
          </Col>
        </Row>

        {/* Multi-series Chart */}
        <Card
          style={{ borderRadius: 12 }}
          title="Totals by Month — All Numeric Fields"
          extra={<Text type="secondary">{selNames.division} • {selNames.screen}</Text>}
        >
          <ChartBody />
        </Card>

        {/* Table */}
        <Card style={{ borderRadius: 12 }} title="Table (all fields)">
          <TableBlock />
        </Card>
      </div>
    </div>
  );
}
