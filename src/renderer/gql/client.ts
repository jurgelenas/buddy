import { ApolloClient, InMemoryCache, ApolloLink } from "@apollo/client";
import { createWebWorkerBusLink } from "apollo-bus-link/webworker";
import { createElectronBusLink } from "apollo-bus-link/electron";
import config from "../../shared/config";

const link = ApolloLink.from([
  // Only need the logger link in development mode
  ...(!config.isProduction
    ? [
        await import("apollo-link-logger").then(
          ({ default: apolloLogger }) => apolloLogger
        ),
      ]
    : []),
  window.ipcRenderer
    ? createElectronBusLink(window.ipcRenderer)
    : createWebWorkerBusLink(
        await import("../../webworker/webworker.bootstrap").then(
          ({ default: Worker }) => Worker
        )
      ),
]);

export default new ApolloClient({
  cache: new InMemoryCache(),
  link,
});
