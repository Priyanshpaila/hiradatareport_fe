import { useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Layout,
  Menu,
  Button,
  Grid,
  Drawer,
  Avatar,
  Dropdown,
  Breadcrumb,
  theme as antdTheme,
} from "antd";
import {
  MenuOutlined,
  HomeOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  SafetyOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import ProtectedRoute from "../auth/ProtectedRoute";
import ThemeProvider from "../components/ThemeProvider";
import SchemaStudio from "../pages/SchemaStudio";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import DivisionScreen from "../pages/DivisionScreen";
import Charts from "../pages/Charts";
import AdminAccess from "../pages/AdminAccess";

// 👉 make sure this file exists (or update the path)
import logo from "../assets/logo.png";

const { Header, Sider, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

/* ----------------------------- Helpers ---------------------------------- */
function useBreadcrumbs() {
  const location = useLocation();
  const pathSnippets = location.pathname.split("/").filter(Boolean);

  const items = pathSnippets.map((snip, idx) => {
    const url = `/${pathSnippets.slice(0, idx + 1).join("/")}`;
    const label =
      snip === "admin"
        ? "Admin"
        : snip === "access"
        ? "Access"
        : snip === "charts"
        ? "Charts"
        : snip === "division"
        ? "Division"
        : snip === "screen"
        ? "Screen"
        : snip;
    return { title: <Link to={url}>{label}</Link> };
  });

  return [
    {
      title: (
        <Link to="/">
          <HomeOutlined />
        </Link>
      ),
    },
    ...items,
  ];
}

function AppLogo({ collapsed = false, variant = "sider" }) {
  // Taller for the sider, compact for the header
  const height = variant === "header" ? (collapsed ? 28 : 32) : (collapsed ? 56 : 72);
  const padding = variant === "header" ? 0 : 8;

  return (
    <Link to="/" style={{ display: "block" }}>
      <div
        style={{
          width: "100%",
          height,
          padding,
          display: "grid",
          placeItems: "center",
        }}
      >
        <img
          src={logo}
          alt="Data Portal"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain", // keep aspect ratio, fill width/height box
            display: "block",
          }}
        />
      </div>
    </Link>
  );
}


/* ----------------------------- Shell ------------------------------------ */
function Shell() {
  const { token } = antdTheme.useToken();
  const { user, logout } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const location = useLocation();
  const navigate = useNavigate();

  const breadcrumbItems = useBreadcrumbs();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/admin")) return "admin";
    if (location.pathname.startsWith("/charts")) return "charts";
    return "dash";
  }, [location.pathname]);

  const menuItems = useMemo(() => {
    const base = [
      {
        key: "dash",
        icon: <HomeOutlined />,
        label: <NavLink to="/">Dashboard</NavLink>,
      },
      {
        key: "charts",
        icon: <BarChartOutlined />,
        label: <NavLink to="/charts">Charts</NavLink>,
      },
    ];
    if (user?.role === "superadmin") {
      base.push({
        key: "admin",
        icon: <SafetyOutlined />,
        label: <NavLink to="/admin">Admin Access</NavLink>,
      });
    }
    return base;
  }, [user?.role]);

  const userMenu = {
    items: [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: "Profile (coming soon)",
      },
      { type: "divider" },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Logout",
        onClick: logout,
      },
    ],
  };

  return (
    // Lock the whole shell to viewport height; page itself won't scroll
    <Layout style={{ height: "100vh", background: token.colorBgLayout }}>
      {/* Fixed Sider (no scroll) */}
      {!isMobile && (
        <Sider
          width={240}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          collapsedWidth={72}
          style={{
            background: "linear-gradient(180deg, #f9fbff 0%, #f5f7fa 100%)",
            borderRight: "1px solid #eef1f5",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}
        >
      <div style={{ padding: 0 }}>
  <AppLogo collapsed={collapsed} />
</div>
          <Menu
            selectedKeys={[selectedKey]}
            mode="inline"
            items={menuItems}
            style={{
              borderInlineEnd: "none",
              background: "transparent",
              padding: "8px 8px 16px",
            }}
          />
        </Sider>
      )}

      {/* Right side column fills height; only Content scrolls */}
      <Layout style={{ height: "100vh" }}>
        {/* Header (fixed at top of the right side) */}
        <Header
          style={{
            flex: "0 0 auto",
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "saturate(160%) blur(6px)",
            padding: "0 16px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {isMobile ? (
            <>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
                style={{ marginRight: 4 }}
              />
             <div style={{ flex: 1 }}>
  <AppLogo variant="header" collapsed={false} />
</div>
            </>
          ) : (
            <Breadcrumb items={breadcrumbItems} style={{ flex: 1 }} />
          )}

          <Dropdown menu={userMenu} trigger={["click"]}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <Avatar style={{ backgroundColor: "#0A66C2" }} size="small">
                {String(user?.fullName || "U").slice(0, 1).toUpperCase()}
              </Avatar>
              <span style={{ fontWeight: 500 }}>{user?.fullName}</span>
            </div>
          </Dropdown>
        </Header>

        {/* ⭐ Content is the ONLY scrollable area */}
        <Content
          style={{
            flex: "1 1 auto",
            overflow: "auto",
            padding: isMobile ? 12 : 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: isMobile ? 12 : 24,
              boxShadow: "0 8px 24px rgba(16,24,40,0.04)",
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/charts" element={<Charts />} />
              <Route
                path="/division/:divisionId/screen/:screenId"
                element={<DivisionScreen />}
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <AdminAccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/schema"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <SchemaStudio />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Content>

        {/* Footer stays pinned under the scrolling Content */}
        <Footer style={{ flex: "0 0 auto", textAlign: "center", color: "#9aa4b2" }}>
          © {new Date().getFullYear()} Data Portal • RR ISPAT — A Unit of GPIL
        </Footer>
      </Layout>

      {/* Mobile Drawer Nav */}
      <Drawer
        title={<AppLogo collapsed={false} />}
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        bodyStyle={{ padding: 0 }}
      >
        <Menu
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => {
            setDrawerOpen(false);
            if (key === "dash") navigate("/");
            if (key === "charts") navigate("/charts");
            if (key === "admin") navigate("/admin");
          }}
        />
      </Drawer>
    </Layout>
  );
}

/* --------------------------- App Router --------------------------------- */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}
