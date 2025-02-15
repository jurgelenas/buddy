// EXECUTES IN A WEB WORKER
/* eslint-disable no-restricted-globals */
import {
  createBusLinkBackend,
  createSchemaExecutor,
} from "apollo-bus-link/core";
import { webWorkerBus } from "apollo-bus-link/webworker";
import {
  createContext,
  createMockContext,
  FileSystemApi,
  schema,
  UsbApi,
} from "shared/backend";
import { showDirectoryPicker, requestDevice } from "./crossboundary/functions";
import { WorkerArgs } from "./types";

const fileSystem: FileSystemApi = {
  requestWritableDirectory: (options) =>
    showDirectoryPicker.call(self, options),
};

const usb: UsbApi = {
  requestDevice: async () => {
    const pickedDevice = await requestDevice.call(self, {
      filters: [],
    });
    const devicesWithPermission = await navigator.usb.getDevices();
    const device = devicesWithPermission.find(
      ({ vendorId, productId }) =>
        vendorId === pickedDevice.vendorId &&
        productId === pickedDevice.productId
    );

    if (!device) {
      throw new Error("Couldn't retrieve device on webworker side");
    }

    return device;
  },
  deviceList: () => navigator.usb.getDevices(),
};

const backend = createBusLinkBackend<WorkerArgs>({
  registerBus: webWorkerBus(self),
  createExecutor: (args) =>
    createSchemaExecutor({
      schema,
      context: args.mocked
        ? createMockContext({
            fileSystem,
          })
        : createContext({
            fileSystem,
            usb,
          }),
    }),
});

void backend.initialise({ mocked: false });
backend.listen();
