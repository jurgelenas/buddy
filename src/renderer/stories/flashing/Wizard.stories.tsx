import { MockedProvider } from "@apollo/client/testing";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import FlashingWizard from "renderer/pages/flash/FlashingWizard";
import {
  devicesQuery,
  firmwareReleaseDescriptionQuery,
  firmwaresQuery,
  targetsQuery,
} from "./mocks";

export default {
  title: "Flashing/Wizard",
  component: FlashingWizard,
};

export const usable: React.FC = () => (
  <MemoryRouter>
    <MockedProvider
      mocks={[
        firmwaresQuery,
        targetsQuery,
        firmwareReleaseDescriptionQuery,
        devicesQuery,
      ]}
    >
      <FlashingWizard />
    </MockedProvider>
  </MemoryRouter>
);
