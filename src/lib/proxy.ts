/**
 * Proxy configuration and agent factory for HTTP requests.
 * Supports HTTP, HTTPS, and SOCKS5 proxies with authentication.
 */

import type { AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { env } from "@/env";

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: "http" | "https" | "socks5";
}

function getProxyConfig(): ProxyConfig {
  return {
    enabled: env.PROXY_ENABLED,
    host: env.PROXY_HOST || "",
    port: env.PROXY_PORT || 0,
    username: env.PROXY_USERNAME,
    password: env.PROXY_PASSWORD,
    protocol: env.PROXY_PROTOCOL,
  };
}

type Agent = HttpsProxyAgent<string> | SocksProxyAgent;

function createAgent(
  config: Required<Pick<ProxyConfig, "host" | "port" | "protocol">> &
    Pick<ProxyConfig, "username" | "password">,
): Agent {
  const { host, port, protocol, username, password } = config;
  const auth = username && password ? `${username}:${password}@` : "";
  const proxyUrl = `${protocol}://${auth}${host}:${port}`;

  switch (protocol) {
    case "http":
    case "https":
      return new HttpsProxyAgent(proxyUrl);
    case "socks5":
      return new SocksProxyAgent(proxyUrl);
    default:
      throw new Error(`Unsupported proxy protocol: ${protocol}`);
  }
}

/**
 * Create a proxy agent based on configuration.
 * Returns null if proxy is disabled or not properly configured.
 */
export function createProxyAgent(
  config?: Partial<ProxyConfig>,
): ReturnType<typeof createAgent> | null {
  const proxyConfig = { ...getProxyConfig(), ...config };

  if (!proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
    return null;
  }

  return createAgent(proxyConfig);
}

/**
 * Check if a proxy agent is available and properly configured.
 */
export function isProxyAvailable(): boolean {
  const config = getProxyConfig();
  return config.enabled && !!config.host && !!config.port;
}

/**
 * Create axios request configuration with proxy support.
 * Returns empty object if proxy is disabled.
 */
export function createAxiosConfig(
  config?: Partial<ProxyConfig>,
): Pick<AxiosRequestConfig, "httpsAgent" | "httpAgent" | "proxy"> {
  const proxyConfig = { ...getProxyConfig(), ...config };

  if (!proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
    return {};
  }

  const proxyAgent = createProxyAgent(config);
  if (proxyAgent) {
    if (proxyConfig.protocol === "socks5") {
      return { httpsAgent: proxyAgent };
    }

    return {
      httpsAgent: proxyAgent,
      httpAgent: proxyAgent,
    };
  }

  return {};
}
