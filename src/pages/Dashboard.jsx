import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, List, Tag, Typography } from "antd";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [grants, setGrants] = useState([]);

  useEffect(() => {
    api.get("/access/my-access").then(({ data }) => setGrants(data));
  }, []);

  return (
    <div style={{ display:"grid", gap:16 }}>
      {grants.map(g => (
        <Card key={g._id} title={`${g.division.name} (${g.division.code})`}>
          <List
            dataSource={g.screens}
            renderItem={s => (
              <List.Item>
                <Link to={`/division/${g.division._id}/screen/${s._id}`}>{s.title}</Link>
                <Tag style={{ marginLeft: 8 }}>{s.key}</Tag>
              </List.Item>
            )}
          />
        </Card>
      ))}
      {grants.length === 0 && (
        <Typography.Text type="secondary">No access yet. Ask SuperAdmin to grant.</Typography.Text>
      )}
    </div>
  );
}
