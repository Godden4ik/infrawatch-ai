import { createProxy } from "../../_proxy";
import { apiBackendUrl } from "@/services/_shared/fetch-server";
const proxy = createProxy(apiBackendUrl, "anomaly");
export const { GET, POST, PUT, DELETE } = proxy;
