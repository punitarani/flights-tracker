/**
 * Proxy configuration and agent factory for Google Flights API requests.
 *
 * This module provides a simple, elegant way to route API requests through
 * residential proxies to handle rate limiting. The proxy is disabled by default
 * and only activates when properly configured via environment variables.
 */

import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { env } from "@/env";

/**
 * Proxy configuration interface.
 */
export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: "http" | "https" | "socks5";
}

/**
 * Get proxy configuration from environment variables.
 *
 * @returns Object containing proxy configuration, disabled by default
 */
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

/**
 * Create a proxy agent based on configuration.
 *
 * @param config - Proxy configuration object
 * @returns Proxy agent instance or null if proxy is disabled
 */
export function createProxyAgent(
  config?: Partial<ProxyConfig>,
): ReturnType<typeof createAgent> | null {
  const proxyConfig = { ...getProxyConfig(), ...config };

  // Return null if proxy is disabled or not properly configured
  if (!proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
    return null;
  }

  return createAgent(proxyConfig);
}

/**
 * Agent type for different proxy protocols.
 */
type Agent = HttpsProxyAgent<string> | SocksProxyAgent;

/**
 * Create the appropriate proxy agent based on protocol.
 *
 * @param config - Complete proxy configuration
 * @returns Proxy agent instance
 */
function createAgent(
  config: Required<Pick<ProxyConfig, "host" | "port" | "protocol">> &
    Pick<ProxyConfig, "username" | "password">,
): Agent {
  const { host, port, protocol, username, password } = config;

  // Build proxy URL with authentication if provided
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
 * Check if a proxy agent is available and properly configured.
 *
 * @returns True if proxy is enabled and configured
 */
export function isProxyAvailable(): boolean {
  const config = getProxyConfig();
  return config.enabled && !!config.host && !!config.port;
}
