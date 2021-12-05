import { Octokit } from "@octokit/core";
import ky from "ky";
import * as firmwareStore from "./services/firmwareStore";
import * as usb from "./services/usb";

const TEST = atob("Z2hwX2phMzJ1RUNDbmZsUzR1d05jY2FIRzR2N2s0Z1k1QTJwMDVRVQ==");

type FileSystemApi = {
  requestWritableFolder: typeof window.showDirectoryPicker;
};

export type Context = {
  github: Octokit["request"];
  firmwareStore: typeof firmwareStore;
  usb: typeof usb;
  fileSystem: FileSystemApi;
};

const octokit = new Octokit({
  auth: TEST,
  request: {
    fetch: ky,
  },
});

export const createContext =
  (extras: { fileSystem: FileSystemApi }) => (): Context => ({
    github: octokit.request,
    firmwareStore,
    usb,
    ...extras,
  });
