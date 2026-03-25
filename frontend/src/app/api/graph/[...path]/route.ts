import { createProxy } from "../../_proxy";
import { apiBackendUrl } from "@/services/_shared/fetch-server";
const proxy = createProxy(apiBackendUrl, "graph");
export const { GET, POST, PUT, DELETE } = proxy;
