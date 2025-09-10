import { ConfigProvider, theme as antdTheme } from "antd";
import "../styles/global.css";

const brand = {
  colorPrimary: "#24AAE2",
  colorInfo: "#24AAE2",
  borderRadius: 10
};

export default function ThemeProvider({ children }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm, // light by default
        token: brand,
        components: {
          Layout: { headerBg: "#ffffff", siderBg: "#f9f9f9" }, // light header + sider
          Menu: { itemBorderRadius: 8 },
          Button: { controlHeight: 36 }
        }
      }}
    >
      {children}
    </ConfigProvider>
  );
}
