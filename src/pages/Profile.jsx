import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Tag,
  message,
  Table,
  Divider,
  Avatar,
  Skeleton,
} from "antd";
import {
  UserOutlined,
  SaveOutlined,
  ReloadOutlined,
  LockOutlined,
  MailOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { api } from "../api";

const { Title, Text } = Typography;

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [access, setAccess] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  // Hard cap helper: trims paste/IME to 8
  const hardCap8 = (e) => (e?.target?.value || "").slice(0, 8);

  const loadMe = async () => {
    try {
      setLoadingMe(true);
      const { data } = await api.get("/auth/me");
      setMe(data || null);
      profileForm.setFieldsValue({
        fullName: data?.fullName || "",
        email: data?.email || "",
      });
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load profile");
    } finally {
      setLoadingMe(false);
    }
  };

  const loadAccess = async () => {
    try {
      setLoadingAccess(true);
      const { data } = await api.get("/access/my-access");
      setAccess(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load access");
    } finally {
      setLoadingAccess(false);
    }
  };

  useEffect(() => {
    loadMe();
    loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setSavingProfile(true);
      const { data } = await api.patch("/auth/profile", {
        fullName: values.fullName,
        email: values.email,
      });
      setMe((prev) => ({ ...prev, ...data }));
      message.success("Profile updated");
    } catch (e) {
      if (!e?.errorFields) {
        message.error(e.response?.data?.message || "Failed to update profile");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      setChangingPwd(true);
      await api.patch("/auth/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      pwdForm.resetFields();
      message.success("Password changed");
    } catch (e) {
      if (!e?.errorFields) {
        message.error(e.response?.data?.message || "Failed to change password");
      }
    } finally {
      setChangingPwd(false);
    }
  };

  const initials = useMemo(() => {
    if (!me?.fullName) return "U";
    const parts = me.fullName.trim().split(/\s+/);
    return parts.map((p) => p[0]?.toUpperCase()).slice(0, 2).join("");
  }, [me?.fullName]);

  const accessColumns = [
    { title: "Division", dataIndex: ["division", "name"], key: "dname" },
    { title: "Code", dataIndex: ["division", "code"], key: "dcode", width: 120 },
    {
      title: "Screens",
      key: "screens",
      render: (_, row) =>
        (row.screens || []).length ? (
          <Space wrap size={[6, 6]}>
            {row.screens.map((s) => (
              <Tag key={s._id} color="blue">
                {s.title}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header Card */}
      <Card
        style={{
          borderRadius: 14,
          background:
            "linear-gradient(135deg, rgba(10,102,194,0.08), rgba(10,102,194,0.02))",
          border: "1px solid #eef2f7",
        }}
        bodyStyle={{ padding: 20 }}
      >
        {loadingMe ? (
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        ) : (
          <Row gutter={[16, 16]} align="middle">
            <Col flex="none">
              <Avatar
                size={72}
                style={{ background: "#0A66C2", fontWeight: 700 }}
              >
                {initials}
              </Avatar>
            </Col>
            <Col flex="auto">
              <Title level={4} style={{ margin: 0 }}>
                {me?.fullName || "—"}
              </Title>
              <Space size="small" wrap>
                <Tag icon={<MailOutlined />} color="default">
                  {me?.email}
                </Tag>
                <Tag icon={<CrownOutlined />} color="gold">
                  {String(me?.role || "user").toUpperCase()}
                </Tag>
              </Space>
            </Col>
            <Col flex="none">
              <Button icon={<ReloadOutlined />} onClick={() => { loadMe(); loadAccess(); }}>
                Refresh
              </Button>
            </Col>
          </Row>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        {/* Edit Details */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>Edit Details</span>
              </Space>
            }
            style={{ borderRadius: 14 }}
          >
            <Form form={profileForm} layout="vertical">
              <Form.Item
                name="fullName"
                label="Full Name"
                rules={[{ required: true, message: "Full name is required" }]}
              >
                <Input placeholder="Your full name" />
              </Form.Item>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: "Email is required" },
                  { type: "email", message: "Enter a valid email" },
                ]}
              >
                <Input placeholder="name@example.com" />
              </Form.Item>

              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingProfile}
                  onClick={onSaveProfile}
                >
                  Save Changes
                </Button>
                <Button onClick={() => profileForm.resetFields()}>Reset</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        {/* Change Password */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <LockOutlined />
                <span>Change Password</span>
              </Space>
            }
            style={{ borderRadius: 14 }}
            extra={<Text type="secondary">Password must be exactly 8 characters</Text>}
          >
            <Form form={pwdForm} layout="vertical">
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: "Current password is required" }]}
                getValueFromEvent={hardCap8}
              >
                <Input.Password placeholder="8 characters" maxLength={8} />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: "New password is required" },
                  { len: 8, message: "Must be exactly 8 characters" },
                ]}
                getValueFromEvent={hardCap8}
              >
                <Input.Password placeholder="8 characters" maxLength={8} />
              </Form.Item>
              <Form.Item
                name="confirm"
                label="Confirm New Password"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "Please confirm the new password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || value === getFieldValue("newPassword")) return Promise.resolve();
                      return Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}
                getValueFromEvent={hardCap8}
              >
                <Input.Password placeholder="8 characters" maxLength={8} />
              </Form.Item>

              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={onChangePassword}
                  loading={changingPwd}
                >
                  Update Password
                </Button>
                <Button onClick={() => pwdForm.resetFields()}>Clear</Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Access */}
      <Card
        title="My Access"
        style={{ borderRadius: 14 }}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAccess}
            loading={loadingAccess}
          >
            Reload
          </Button>
        }
      >
        <Text type="secondary">
          Your division access and permitted screens are listed below.
        </Text>
        <Divider style={{ margin: "12px 0 16px" }} />
        <Table
          rowKey={(r) => r._id || `${r?.division?._id}`}
          loading={loadingAccess}
          dataSource={access}
          columns={accessColumns}
          pagination={{ pageSize: 8 }}
        />
      </Card>
    </div>
  );
}
