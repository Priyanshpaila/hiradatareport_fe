import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Card, List, Tag, Typography, Row, Col, Skeleton, Empty } from "antd";
import { Link } from "react-router-dom";
import { RightOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

// Build a friendly route when possible; fall back to id route
function makeScreenPath(division, screen) {
  if (division?.code && screen?.key) {
    return `/division/${encodeURIComponent(
      division.code
    )}/screen/${encodeURIComponent(screen.key)}`;
  }
 
  return `/division/${division?._id}/screen/${screen?._id}`;
}

export default function Dashboard() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/access/my-access");
        if (mounted) setGrants(Array.isArray(data) ? data : []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Nicely sort divisions and screens by name/title
  const sorted = useMemo(() => {
    return (grants || [])
      .slice()
      .sort((a, b) =>
        (a?.division?.name || "").localeCompare(b?.division?.name || "")
      )
      .map((g) => ({
        ...g,
        screens: (g?.screens || [])
          .slice()
          .sort((a, b) => (a?.title || "").localeCompare(b?.title || "")),
      }));
  }, [grants]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Title level={4} style={{ margin: 0 }}>
        Your Access
      </Title>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} xs={24} md={12} lg={8}>
              <Card style={{ borderRadius: 12 }}>
                <Skeleton active />
              </Card>
            </Col>
          ))}
        </Row>
      ) : sorted.length === 0 ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty
            description={
              <Text type="secondary">
                No access yet. Please contact a SuperAdmin to grant access.
              </Text>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {sorted.map((g) => (
            <Col key={g._id || g?.division?._id} xs={24} md={12} lg={8}>
              <Card
                style={{ borderRadius: 12 }}
                title={
                  <div
                    style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {g?.division?.name || "Division"}
                    </span>
                    {g?.division?.code && (
                      <Tag color="blue">{g.division.code}</Tag>
                    )}
                  </div>
                }
                extra={<Tag>{(g?.screens || []).length} screens</Tag>}
                bodyStyle={{ padding: 12 }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={g.screens || []}
                  locale={{
                    emptyText: <Text type="secondary">No screens</Text>,
                  }}
                  renderItem={(s) => (
                    <List.Item style={{ paddingLeft: 8, paddingRight: 8 }}>
                      <List.Item.Meta
                        title={
                          <Link
                            to={makeScreenPath(g.division, s)}
                            style={{ fontWeight: 500 }}
                          >
                            {s.title}
                          </Link>
                        }
                        description={
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {s?.key && <Tag>{s.key}</Tag>}
                            {s?.description && (
                              <Text type="secondary">{s.description}</Text>
                            )}
                          </div>
                        }
                      />
                      <Link to={makeScreenPath(g.division, s)}>
                        <RightOutlined />
                      </Link>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
