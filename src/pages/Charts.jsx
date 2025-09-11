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
  Alert,
  Table,
  Tag,
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
import logo from "../assets/logo1.png";

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
  ScatterChart,
  Scatter,
} from "recharts";

const { Text, Title } = Typography;

/* -------------------------------- helpers -------------------------------- */
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

const toCSV = (rows) => {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
  );
  return [headers.join(","), ...body].join("\n");
};

const downloadCSV = (rows, filename) => {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const monthStartISO = (months) =>
  dayjs()
    .startOf("month")
    .subtract(months - 1, "month")
    .toISOString();

function buildColumns(schemaProps) {
  const cols = [];
  const entries = Object.entries(schemaProps || {});
  for (const [key, def] of entries) {
    cols.push({
      dataIndex: key,
      key,
      title: def?.title || key,
      ellipsis: true,
      render: (v) => {
        if (v === null || v === undefined || v === "")
          return <Text type="secondary">—</Text>;
        if (typeof v === "boolean")
          return <Tag color={v ? "green" : ""}>{v ? "Yes" : "No"}</Tag>;
        if (Array.isArray(v))
          return v.length ? v.join(", ") : <Text type="secondary">[]</Text>;
        if (typeof v === "object")
          return (
            <Text code ellipsis>
              {JSON.stringify(v)}
            </Text>
          );
        return String(v);
      },
    });
  }
  cols.push(
    {
      dataIndex: "__submittedByName",
      title: "Submitted By",
      key: "__submittedByName",
      width: 180,
      ellipsis: true,
    },
    {
      dataIndex: "__createdAtLabel",
      title: "Submitted At",
      key: "__createdAtLabel",
      width: 180,
    },
    { dataIndex: "__version", title: "Version", key: "__version", width: 90 }
  );
  return cols;
}

function toFlatRow(item) {
  return {
    ...(item.data || {}),
    __submittedByName: item.submittedByName || "",
    __createdAtLabel: dayjs(item.createdAt).format("DD MMM YYYY, HH:mm"),
    __version: item.formVersion,
    __id: item._id,
  };
}

/* Build combined scatter series per field: {key,label,points:[{x,y}]} */
function buildPerSubmissionSeries(rowsFlat, numericFields, useCustomDate) {
  const series = numericFields.map((f) => ({
    key: f.value,
    label: f.label,
    points: [],
  }));
  const idx = Object.fromEntries(series.map((s) => [s.key, s]));
  for (const r of rowsFlat) {
    const xISO = useCustomDate && r.__dateISO ? r.__dateISO : r.__createdAtISO;
    const x = xISO && dayjs(xISO).isValid() ? dayjs(xISO).valueOf() : null;
    if (!x) continue;
    for (const f of numericFields) {
      const y = Number(r[f.value]);
      if (Number.isFinite(y)) idx[f.value].points.push({ x, y });
    }
  }
  series.forEach((s) => s.points.sort((a, b) => a.x - b.x));
  return series;
}

/* Build monthly SUM & AVG across all numeric fields (one series object per month) */
function buildMonthlyAggregates(rowsFlat, numericFields, useCustomDate) {
  const m = new Map(); // "YYYY-MM" -> { month, monthLabel, sums:{}, counts:{} }
  for (const r of rowsFlat) {
    const xISO = useCustomDate && r.__dateISO ? r.__dateISO : r.__createdAtISO;
    const mKey =
      xISO && dayjs(xISO).isValid() ? dayjs(xISO).format("YYYY-MM") : null;
    if (!mKey) continue;
    if (!m.has(mKey)) {
      m.set(mKey, {
        month: mKey,
        monthLabel: dayjs(mKey + "-01").format("MMM YYYY"),
        sums: Object.fromEntries(numericFields.map((f) => [f.value, 0])),
        counts: Object.fromEntries(numericFields.map((f) => [f.value, 0])),
      });
    }
    const bucket = m.get(mKey);
    for (const f of numericFields) {
      const v = Number(r[f.value]);
      if (Number.isFinite(v)) {
        bucket.sums[f.value] += v;
        bucket.counts[f.value] += 1;
      }
    }
  }
  const sorted = Array.from(m.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
  const sumSeries = sorted.map((b) => {
    const row = { month: b.month, monthLabel: b.monthLabel };
    for (const f of numericFields)
      row[f.value] = Number(b.sums[f.value].toFixed(2));
    return row;
  });
  const avgSeries = sorted.map((b) => {
    const row = { month: b.month, monthLabel: b.monthLabel };
    for (const f of numericFields) {
      const c = b.counts[f.value] || 0;
      row[f.value] = c ? Number((b.sums[f.value] / c).toFixed(2)) : 0;
    }
    return row;
  });
  return { sumSeries, avgSeries };
}

/* -------------------------------- component ------------------------------- */
export default function Charts() {
  // Access/selection
  const [grants, setGrants] = useState([]);
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

  const [sel, setSel] = useState(null); // { divisionId, screenId }
  const [selNames, setSelNames] = useState({ division: "", screen: "" });

  // Schema catalogs
  const [schemaProps, setSchemaProps] = useState({});
  const [numericFields, setNumericFields] = useState([]); // [{label,value}]
  const [dateFields, setDateFields] = useState([]); // [{label,value}]
  const [dateChoice, setDateChoice] = useState("createdAt"); // 'createdAt' | schema date key

  // Data
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(12);
  const [rowsFlat, setRowsFlat] = useState([]);

  // Charts
  const [chartType, setChartType] = useState("line"); // 'line' | 'area' | 'bar'

  // derived
  const perSubmissionSeries = useMemo(
    () =>
      buildPerSubmissionSeries(
        rowsFlat,
        numericFields,
        dateChoice !== "createdAt"
      ),
    [rowsFlat, numericFields, dateChoice]
  );
  const { sumSeries, avgSeries } = useMemo(
    () =>
      buildMonthlyAggregates(
        rowsFlat,
        numericFields,
        dateChoice !== "createdAt"
      ),
    [rowsFlat, numericFields, dateChoice]
  );

  // KPIs — from SUM series (all fields total)
  const kpis = useMemo(() => {
    if (!sumSeries.length || !numericFields.length)
      return { last: 0, mom: 0, lastLabel: "—", total: 0 };
    const totalPerRow = sumSeries.map((r) =>
      numericFields.reduce((acc, f) => acc + (Number(r[f.value]) || 0), 0)
    );
    const last = totalPerRow.at(-1) || 0;
    const prev = totalPerRow.at(-2) || 0;
    const mom = prev ? ((last - prev) / prev) * 100 : 0;
    const total = totalPerRow.reduce((a, b) => a + b, 0);
    return {
      last: Number(last.toFixed(2)),
      mom: Number(mom.toFixed(1)),
      lastLabel: sumSeries.at(-1)?.monthLabel || "—",
      total: Number(total.toFixed(2)),
    };
  }, [sumSeries, numericFields]);

  // table columns
  const tableColumns = useMemo(() => buildColumns(schemaProps), [schemaProps]);

  /* -------------------------------- data load -------------------------------- */
  const loadSchema = async (divisionId, screenId) => {
    setSchemaProps({});
    setNumericFields([]);
    setDateFields([]);
    try {
      const { data } = await api.get(`/forms/${divisionId}/${screenId}/schema`);
      const props = data?.schema?.properties || {};
      setSchemaProps(props);
      const nums = Object.entries(props)
        .filter(([, def]) => def?.type === "number" || def?.type === "integer")
        .map(([name, def]) => ({ value: name, label: def?.title || name }));
      setNumericFields(nums);
      const dates = Object.entries(props)
        .filter(
          ([, def]) => def?.format === "date" || def?.format === "date-time"
        )
        .map(([name, def]) => ({ value: name, label: def?.title || name }));
      setDateFields([{ value: "createdAt", label: "Created At" }, ...dates]);
      setDateChoice("createdAt");
    } catch (e) {
      message.error(e?.response?.data?.message || "Failed to load schema");
    }
  };

  const loadAllRows = async (
    divisionId,
    screenId,
    dateField,
    monthsLookback
  ) => {
    setLoading(true);
    try {
      const params = { page: 1, limit: 1000 };
      if (dateField && dateField !== "createdAt") params.dateField = dateField;
      if (monthsLookback !== "all")
        params.since = monthStartISO(monthsLookback);
      let all = [];
      let total = 0;
      let page = 1;
      for (;;) {
        const { data } = await api.get(
          `/analytics/${divisionId}/${screenId}/rows`,
          { params: { ...params, page } }
        );
        total = data?.total || 0;
        const items = Array.isArray(data?.items) ? data.items : [];
        all = all.concat(items);
        if (all.length >= total || items.length === 0 || page >= 50) break;
        page += 1;
      }
      const flat = all.map((it) => {
        const row = toFlatRow(it);
        row.__createdAtISO = it.createdAt;
        if (dateField && dateField !== "createdAt") {
          const dv = it?.data ? it.data[dateField] : null;
          row.__dateISO = dv ? dayjs(dv).toISOString() : null;
        }
        return row;
      });
      setRowsFlat(flat);
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.message || "Failed to load rows");
      setRowsFlat([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!sel) return;
      await loadSchema(sel.divisionId, sel.screenId);
      await loadAllRows(sel.divisionId, sel.screenId, "createdAt", months);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  useEffect(() => {
    if (!sel) return;
    loadAllRows(sel.divisionId, sel.screenId, dateChoice, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, dateChoice]);

  const reload = () =>
    sel && loadAllRows(sel.divisionId, sel.screenId, dateChoice, months);

  /* ------------------------------ chart bits ------------------------------ */
  const AggregatedMultiChart = ({ data, title }) => {
    if (loading) {
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      );
    }
    if (!data.length || !numericFields.length) {
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Empty description="No data to display" />
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

    // --- NEW: compute the chart once, with a safe fallback ---
    let renderedChart = null;

    if (chartType === "bar") {
      renderedChart = (
        <BarChart data={data}>
          {common}
          {numericFields.map((f, i) => (
            <Bar
              key={f.value}
              dataKey={f.value}
              name={f.label}
              fill={PALETTE[i % PALETTE.length]}
            />
          ))}
        </BarChart>
      );
    } else if (chartType === "area") {
      renderedChart = (
        <AreaChart data={data}>
          {common}
          {numericFields.map((f, i) => (
            <Area
              key={f.value}
              type="monotone"
              dataKey={f.value}
              name={f.label}
              stroke={PALETTE[i % PALETTE.length]}
              fill={PALETTE[i % PALETTE.length]}
            />
          ))}
        </AreaChart>
      );
    } else if (chartType === "line") {
      renderedChart = (
        <LineChart data={data}>
          {common}
          {numericFields.map((f, i) => (
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
      );
    }

    // Fallback if chartType is invalid
    if (!renderedChart) {
      renderedChart = (
        <LineChart data={data}>
          {common}
          {numericFields.map((f, i) => (
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
      );
    }

    return (
      <Card
        style={{ borderRadius: 12 }}
        title={title}
        extra={
          <Text type="secondary">
            {selNames.division} • {selNames.screen}
          </Text>
        }
      >
        {/* keep the remount-for-type-change wrapper */}
        <div key={`wrap-${title}-${chartType}`}>
          <ResponsiveContainer width="100%" height={380}>
            {renderedChart}
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  const CombinedScatterAllSubmissions = () => {
    if (loading)
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      );
    if (!rowsFlat.length || !numericFields.length) {
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Empty description="No submissions found" />
        </div>
      );
    }
    return (
      <Card
        style={{ borderRadius: 12 }}
        title="All Submissions — Overlay (every numeric field)"
        extra={
          <Text type="secondary">
            {selNames.division} • {selNames.screen}
          </Text>
        }
      >
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              tickFormatter={(v) => dayjs(v).format("DD MMM")}
              name="Date"
              domain={["auto", "auto"]}
            />
            <YAxis dataKey="y" name="Value" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              labelFormatter={(label) =>
                dayjs(label).format("DD MMM YYYY, HH:mm")
              }
              formatter={(value) => [value, "Value"]}
            />
            <Legend />
            {perSubmissionSeries.map((s, i) => (
              <Scatter
                key={s.key}
                name={
                  numericFields.find((f) => f.value === s.key)?.label || s.key
                }
                data={s.points}
                fill={PALETTE[i % PALETTE.length]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>
    );
  };

  const FieldMiniCharts = () => {
    if (!numericFields.length) return null;
    return (
      <Row gutter={[16, 16]}>
        {numericFields.map((f, idx) => {
          const points =
            perSubmissionSeries.find((s) => s.key === f.value)?.points || [];
          const data = points.map((p) => ({ x: p.x, y: p.y }));
          return (
            <Col key={f.value} xs={24} md={12} lg={8}>
              <Card size="small" style={{ borderRadius: 12 }} title={f.label}>
                {data.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        tickFormatter={(v) => dayjs(v).format("DD MMM")}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(v) =>
                          dayjs(v).format("DD MMM YYYY, HH:mm")
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke={PALETTE[idx % PALETTE.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No points"
                  />
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  /* ------------------------------- exports ------------------------------- */
  const exportSumCSV = () => {
    if (!sumSeries.length) return message.info("Nothing to export");
    downloadCSV(
      sumSeries,
      `sum_${selNames.division}_${selNames.screen}_${
        months === "all" ? "all" : months + "m"
      }.csv`
    );
  };
  const exportAvgCSV = () => {
    if (!avgSeries.length) return message.info("Nothing to export");
    downloadCSV(
      avgSeries,
      `avg_${selNames.division}_${selNames.screen}_${
        months === "all" ? "all" : months + "m"
      }.csv`
    );
  };
  const exportRawCSV = () => {
    if (!rowsFlat.length) return message.info("Nothing to export");
    downloadCSV(
      rowsFlat,
      `raw_${selNames.division}_${selNames.screen}_${
        months === "all" ? "all" : months + "m"
      }.csv`
    );
  };

  /* -------------------------------- render -------------------------------- */
  return (
    <div>
      {/* Controls */}
      <Card
        className="pdf-hide"
        style={{ borderRadius: 12, marginBottom: 16 }}
        bodyStyle={{ display: "grid", gap: 12 }}
      >
        <Space wrap>
          <Select
            style={{ minWidth: 360 }}
            placeholder="Choose Division / Screen"
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
              { label: "3m", value: 3 },
              { label: "6m", value: 6 },
              { label: "12m", value: 12 },
              { label: "24m", value: 24 },
              { label: "All", value: "all" },
            ]}
            value={months}
            onChange={setMonths}
          />

          <Select
            style={{ minWidth: 220 }}
            placeholder="Date source"
            value={dateChoice}
            onChange={setDateChoice}
            options={dateFields}
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
            onChange={(v) => setChartType(v ? String(v) : "line")} // normalize to string
          />

          <Button icon={<ReloadOutlined />} onClick={reload} />
        </Space>

        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={exportSumCSV}>
            Download SUM CSV
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportAvgCSV}>
            Download AVG CSV
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportRawCSV}>
            Download RAW CSV
          </Button>

          <ExportA3Button
            targetId="charts-root"
            fileName="visualization-a3.pdf"
            title="Division Analytics"
            logoSrc={logo}
            meta={{
              Division: selNames.division || "—",
              Screen: selNames.screen || "—",
              Period: months === "all" ? "All time" : `Last ${months} months`,
              "Numeric fields": numericFields.length || "—",
              "Date Source":
                dateFields.find((d) => d.value === dateChoice)?.label ||
                dateChoice,
            }}
          />
        </Space>
      </Card>

      <div id="charts-root" style={{ display: "grid", gap: 16 }}>
        {/* KPIs */}
        <section data-pdf-block>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
                <Title level={5} style={{ margin: 0 }}>
                  Last Bucket (SUM of all fields)
                </Title>
                <Text style={{ fontSize: 24, fontWeight: 700 }}>
                  {kpis.last}
                </Text>
                <div>
                  <Text type="secondary">{kpis.lastLabel}</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
                <Title level={5} style={{ margin: 0 }}>
                  MoM Change
                </Title>
                <Text style={{ fontSize: 24, fontWeight: 700 }}>
                  {kpis.mom > 0 ? `+${kpis.mom}%` : `${kpis.mom}%`}
                </Text>
                <div>
                  <Text type="secondary">vs previous month</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
                <Title level={5} style={{ margin: 0 }}>
                  Total (period, SUM of all fields)
                </Title>
                <Text style={{ fontSize: 24, fontWeight: 700 }}>
                  {kpis.total}
                </Text>
                <div>
                  <Text type="secondary">
                    {months === "all" ? "All time" : `Last ${months} months`}
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        </section>
        {/* Overlay of every submission for all fields */}
        <section data-pdf-block>
          <CombinedScatterAllSubmissions />
        </section>
        {/* Mini charts: one per numeric field (submissions over time) */}
        <section data-pdf-block>
          <FieldMiniCharts />
        </section>
        {/* Aggregated charts */}
        <section data-pdf-block>
          <AggregatedMultiChart
            data={sumSeries}
            title="Monthly SUM — All Numeric Fields"
          />
        </section>
        <section data-pdf-block>
          <AggregatedMultiChart
            data={avgSeries}
            title="Monthly AVG — All Numeric Fields"
          />
        </section>
        {/* Raw Table */}
        <section data-pdf-block>
          <Card style={{ borderRadius: 12 }} title="All Submissions (raw)">
            {loading ? (
              <div style={{ textAlign: "center", padding: 24 }}>
                <Spin />
              </div>
            ) : rowsFlat.length === 0 ? (
              <Empty description="No submissions" />
            ) : (
              <>
                <Alert
                  className="pdf-hide"
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  description="Scroll horizontally to view all fields. Charts above are built directly from this data."
                />
                <Table
                  size="small"
                  rowKey="__id"
                  dataSource={rowsFlat}
                  columns={tableColumns}
                  scroll={{ x: "max-content", y: 480 }}
                  pagination={{ pageSize: 20 }}
                />
              </>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
