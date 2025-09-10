import { useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Tabs,
  Typography,
  Space,
  Divider
} from "antd";
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/useAuth";
import logo from "../assets/logo1.png"; // <- your PNG logo

export default function Login() {
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);

  const onLogin = async (v) => {
    try {
      setLoading(true);
      await login(v.email, v.password);
      location.href = "/";
    } catch (e) {
      message.error(e.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (v) => {
    try {
      setLoading(true);
      await register(v.fullName, v.email, v.password);
      location.href = "/";
    } catch (e) {
      message.error(e.response?.data?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  };

  // Exactly 8 characters + UI hard-cap
  const passwordRule = [
    { required: true, message: "Password is required" },
    { len: 8, message: "Password must be exactly 8 characters" },
  ];

  // Helper: enforce at most 8 chars even on paste/IME
  const take8 = (e) => (e?.target?.value || "").slice(0, 8);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "radial-gradient(1200px 600px at 10% 10%, #e8f3ff 0%, transparent 50%), radial-gradient(1000px 500px at 100% 0%, #f3f7ff 0%, transparent 50%), linear-gradient(135deg, #f7fbff, #f9fbff)",
      }}
    >
      <Card
        style={{
          width: 480,
          maxWidth: "100%",
          borderRadius: 18,
          border: "1px solid #eef2f7",
          boxShadow: "0 20px 60px rgba(10,102,194,0.08)",
        }}
        bodyStyle={{ padding: 24 }}
      >
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: "100%",
              height: 120,
              padding: 9,
              display: "grid",
              placeItems: "center",
            }}
          >
            <img
              src={logo}
              alt="Brand"
              style={{
                width: "75%",
                height: "75%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
       
        </div>

        {/* <Divider style={{ margin: "12px 0 20px" }} /> */}

        <Tabs
          centered
          items={[
            {
              key: "login",
              label: "Login",
              children: (
                <Form layout="vertical" onFinish={onLogin} autoComplete="on">
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, type: "email", message: "Enter a valid email" },
                    ]}
                  >
                    <Input
                      size="large"
                      allowClear
                      placeholder="you@company.com"
                      prefix={<MailOutlined />}
                      autoComplete="email"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={passwordRule}
                    // Crucial: capture value and hard-cap to 8
                    getValueFromEvent={take8}
                  >
                    <Input.Password
                      size="large"
                      placeholder="8 characters"
                      prefix={<LockOutlined />}
                      maxLength={8}           // hard cap while typing
                      autoComplete="current-password"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    block
                    style={{
                      marginTop: 4,
                      background: "linear-gradient(90deg, #0A66C2, #2b8ae0)",
                    }}
                  >
                    Sign In
                  </Button>
                </Form>
              ),
            },
            {
              key: "register",
              label: "Register",
              children: (
                <Form layout="vertical" onFinish={onRegister} autoComplete="on">
                  <Form.Item
                    name="fullName"
                    label="Full Name"
                    rules={[{ required: true, message: "Enter your full name" }]}
                  >
                    <Input
                      size="large"
                      allowClear
                      placeholder="Your full name"
                      prefix={<UserOutlined />}
                      autoComplete="name"
                    />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, type: "email", message: "Enter a valid email" },
                    ]}
                  >
                    <Input
                      size="large"
                      allowClear
                      placeholder="you@company.com"
                      prefix={<MailOutlined />}
                      autoComplete="email"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={passwordRule}
                    getValueFromEvent={take8}
                  >
                    <Input.Password
                      size="large"
                      placeholder="8 characters"
                      prefix={<LockOutlined />}
                      maxLength={8}
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={loading}
                      block
                      style={{
                        background: "linear-gradient(90deg, #0A66C2, #2b8ae0)",
                      }}
                    >
                      Create Account
                    </Button>
                 
                  </Space>
                </Form>
              ),
            },
          ]}
        />

        {/* Footnote */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Typography.Text style={{ color: "#98a2b3" }}>
            By continuing, you agree to our Terms & Privacy Policy.
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
