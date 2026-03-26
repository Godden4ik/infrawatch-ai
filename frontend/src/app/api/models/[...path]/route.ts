import { createProxy } from "../../_proxy";
import { apiBackendUrl } from "@/services/_shared/fetch-server";
const proxy = createProxy(apiBackendUrl, "models");
export const { GET, POST, PUT, DELETE } = proxy;
