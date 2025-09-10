import { useState } from "react";
import { Card, Form, Input, Button, message, Tabs, Typography } from "antd";
import { useAuth } from "../auth/useAuth";

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

  const passwordRule = [
    { required: true, message: "Password is required" },
    {
      len: 8,
      message: "Password must be exactly 8 characters"
    }
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #e0f0ff, #f8faff)"
      }}
    >
      <Card
        style={{
          width: 420,
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          padding: "24px 16px"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Typography.Title level={3} style={{ margin: 0, color: "#0A66C2" }}>
            Division Forms Portal
          </Typography.Title>
          <Typography.Text type="secondary">
            Welcome! Please login or register
          </Typography.Text>
        </div>

        <Tabs
          centered
          items={[
            {
              key: "login",
              label: "Login",
              children: (
                <Form layout="vertical" onFinish={onLogin}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: "email", message: "Enter valid email" }]}
                  >
                    <Input placeholder="Enter your email" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={passwordRule}>
                    <Input.Password placeholder="8 characters" />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{ marginTop: 8 }}
                  >
                    Login
                  </Button>
                </Form>
              )
            },
            {
              key: "register",
              label: "Register",
              children: (
                <Form layout="vertical" onFinish={onRegister}>
                  <Form.Item
                    name="fullName"
                    label="Full Name"
                    rules={[{ required: true, message: "Enter your full name" }]}
                  >
                    <Input placeholder="Your full name" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: "email", message: "Enter valid email" }]}
                  >
                    <Input placeholder="Enter your email" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={passwordRule}>
                    <Input.Password placeholder="8 characters" />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{ marginTop: 8 }}
                  >
                    Create Account
                  </Button>
                </Form>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
