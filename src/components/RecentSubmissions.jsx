import { useMemo, useState } from "react";
import { Card, List, Tag, Typography, Descriptions, Space, Button, Drawer, Empty } from "antd";
import dayjs from "dayjs";

const { Text } = Typography;

function formatValue(val) {
  if (val === null || val === undefined) return <Text type="secondary">—</Text>;
  if (typeof val === "boolean") return <Tag color={val ? "green" : "default"}>{val ? "Yes" : "No"}</Tag>;
  if (Array.isArray(val)) return val.length ? val.join(", ") : <Text type="secondary">[]</Text>;
  if (typeof val === "object") return <Text code ellipsis>{JSON.stringify(val)}</Text>;
  return String(val);
}

export default function RecentSubmissions({ submissions = [], schema }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const fieldEntries = Object.entries(schema?.properties || {});
  const fieldOrder = fieldEntries.map(([name]) => name);
  const primaryFields = fieldOrder.slice(0, 6); // show first 6 fields by default

  const listData = useMemo(() => submissions, [submissions]);

  if (!listData.length) {
    return (
      <Card style={{ borderRadius: 12 }} title="Recent Submissions">
        <Empty description="No submissions yet" />
      </Card>
    );
  }

  return (
    <Card style={{ borderRadius: 12 }} title="Recent Submissions">
      <List
        grid={{ gutter: 12, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
        dataSource={listData}
        renderItem={(item) => {
          const d = item.data || {};
          return (
            <List.Item key={item._id}>
              <Card
                size="small"
                style={{ borderRadius: 12, height: "100%" }}
                title={
                  <Space align="center">
                    <Tag color="blue">v{item.formVersion}</Tag>
                    <Text type="secondary">{dayjs(item.createdAt).format("DD MMM YYYY, HH:mm")}</Text>
                  </Space>
                }
                extra={
                  <Button
                    size="small"
                    onClick={() => {
                      setDetail(item);
                      setOpen(true);
                    }}
                  >
                    View details
                  </Button>
                }
              >
                <Descriptions
                  size="small"
                  column={1}
                  colon
                  items={primaryFields.map((f) => ({
                    key: f,
                    label: schema?.properties?.[f]?.title || f,
                    children: formatValue(d[f]),
                  }))}
                />
              </Card>
            </List.Item>
          );
        }}
      />

      <Drawer
        title="Submission Details"
        open={open}
        onClose={() => setOpen(false)}
        width={640}
      >
        {detail ? (
          <>
            <Descriptions
              size="small"
              column={1}
              colon
              items={fieldOrder.map((f) => ({
                key: f,
                label: schema?.properties?.[f]?.title || f,
                children: formatValue(detail.data?.[f]),
              }))}
            />
            <div style={{ marginTop: 16 }}>
              <Space wrap size="small">
                <Tag color="blue">Version: v{detail?.formVersion}</Tag>
                <Tag>Submitted: {dayjs(detail?.createdAt).format("DD MMM YYYY, HH:mm")}</Tag>
                {detail?.submittedBy && <Tag color="geekblue">By: {String(detail.submittedBy).slice(0, 8)}</Tag>}
              </Space>
            </div>
          </>
        ) : null}
      </Drawer>
    </Card>
  );
}
