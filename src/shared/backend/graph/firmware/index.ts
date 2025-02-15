import gql from "graphql-tag";
import { GraphQLError } from "graphql";
import {
  EdgeTxFirmwareBundle,
  Resolvers,
} from "shared/backend/graph/__generated__";
import config from "shared/config";

const typeDefs = gql`
  type Query {
    edgeTxReleases: [EdgeTxRelease!]!
    edgeTxRelease(id: ID!): EdgeTxRelease
    edgeTxPrs: [EdgeTxPr!]!
    edgeTxPr(id: ID!): EdgeTxPr
    localFirmware(byId: ID!): LocalEdgeTxFirmware
  }

  type Mutation {
    registerLocalFirmware(
      fileName: String
      firmwareBase64Data: String!
    ): LocalEdgeTxFirmware!
  }

  type EdgeTxRelease {
    id: ID!
    isPrerelease: Boolean!
    name: String!
    description: String
    firmwareBundle: EdgeTxFirmwareBundle!
    assets: [EdgeTxReleaseAsset!]!
  }

  type EdgeTxPr {
    id: ID!
    name: String!
    description: String!
    commits: [EdgeTxPrCommit!]!
    headCommitId: String!
  }

  type EdgeTxPrCommit {
    id: ID!
    firmwareBundle: EdgeTxFirmwareBundle
  }

  type EdgeTxReleaseAsset {
    id: ID!
    name: String!
    url: String!
  }

  type EdgeTxFirmwareTarget {
    id: ID!
    name: String!
    bundleUrl: String!
    base64Data: String!
  }

  type LocalEdgeTxFirmware {
    id: ID!
    name: String!
    base64Data: String!
  }

  type EdgeTxFirmwareBundle {
    id: ID!
    url: String!
    targets: [EdgeTxFirmwareTarget!]!
    target(id: ID!): EdgeTxFirmwareTarget
  }
`;

const resolvers: Resolvers = {
  Query: {
    edgeTxReleases: async (_, __, { github }) => {
      const releasesRequest = await github(
        "GET /repos/{owner}/{repo}/releases",
        {
          owner: config.github.organization,
          repo: config.github.repos.firmware,
        }
      );

      return releasesRequest.data.map((release) => ({
        id: release.tag_name,
        name: release.name ?? release.tag_name,
        description: release.body_text,
        isPrerelease: release.prerelease,
        firmwareBundle: {} as EdgeTxFirmwareBundle,
        assets: release.assets.map((asset) => ({
          id: asset.id.toString(),
          name: asset.name,
          url: asset.browser_download_url,
        })),
      }));
    },
    edgeTxRelease: async (_, { id }, { github }) => {
      const releaseRequest = await github(
        "GET /repos/{owner}/{repo}/releases/tags/{tag}",
        {
          owner: config.github.organization,
          repo: config.github.repos.firmware,
          tag: id,
        }
      ).catch((e: { status?: number } | Error) => {
        if ("status" in e && e.status && e.status === 404) {
          return undefined;
        }
        throw e as Error;
      });

      if (!releaseRequest) {
        return null;
      }
      const release = releaseRequest.data;

      return {
        id: release.tag_name,
        name: release.name ?? release.tag_name,
        description: release.body,
        isPrerelease: release.prerelease,
        // Will be resolved
        firmwareBundle: {} as EdgeTxFirmwareBundle,
        assets: release.assets.map((asset) => ({
          id: asset.id.toString(),
          name: asset.name,
          url: asset.browser_download_url,
        })),
      };
    },
    edgeTxPrs: async (_, __, { github }) => {
      const prs = await github("GET /repos/{owner}/{repo}/pulls", {
        owner: config.github.organization,
        repo: config.github.repos.firmware,
        sort: "updated",
        state: "open",
      });

      return prs.data.map((pr) => ({
        id: pr.number.toString(),
        name: pr.head.label,
        headCommitId: pr.head.sha,
        commits: [],
        description: `#${pr.title}\n${pr.body as string}`,
      }));
    },
    edgeTxPr: async (_, { id }, { github }) => {
      const pr = (
        await github("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner: config.github.organization,
          repo: config.github.repos.firmware,
          pull_number: Number(id),
        })
      ).data;

      return {
        id: pr.number.toString(),
        name: pr.head.label,
        headCommitId: pr.head.sha,
        commits: [],
        description: `#${pr.title}\n${pr.body as string}`,
      };
    },
    localFirmware: (_, { byId }, { firmwareStore }) => {
      const file = firmwareStore.getLocalFirmwareById(byId);

      if (!file) {
        return null;
      }

      return {
        id: file.id,
        name: file.name ?? file.id,
        base64Data: file.data.toString("base64"),
      };
    },
  },
  Mutation: {
    registerLocalFirmware: (
      _,
      { fileName, firmwareBase64Data },
      { firmwareStore }
    ) => {
      const id = firmwareStore.registerFirmware(
        Buffer.from(firmwareBase64Data, "base64"),
        fileName ?? undefined
      );

      return { id, name: fileName ?? id, base64Data: firmwareBase64Data };
    },
  },
  EdgeTxRelease: {
    firmwareBundle: (release) => {
      const firmwareAsset = release.assets.find((asset) =>
        asset.name.includes("firmware")
      );

      if (!firmwareAsset) {
        throw new GraphQLError("Error");
      }

      return {
        id: firmwareAsset.id,
        name: firmwareAsset.name,
        url: firmwareAsset.url,
        targets: [],
      };
    },
  },
  EdgeTxPr: {
    commits: async ({ id }, _, { github }) => {
      const commits = await github(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
        {
          repo: config.github.repos.firmware,
          owner: config.github.organization,
          pull_number: Number(id),
        }
      );

      return commits.data.map((commit) => ({
        id: commit.sha,
        firmwareBundle: null,
      }));
    },
  },
  EdgeTxPrCommit: {
    firmwareBundle: async ({ id }, _, { github }) => {
      const checks = (
        await github("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
          repo: config.github.repos.firmware,
          owner: config.github.organization,
          ref: id,
        })
      ).data;

      const githubActionsRun = checks.check_runs.find(
        (run) =>
          run.app?.slug === "github-actions" &&
          run.name.toLowerCase().includes("build")
      );

      if (!githubActionsRun) {
        return null;
      }

      const job = await github(
        "GET /repos/{owner}/{repo}/actions/jobs/{job_id}",
        {
          repo: config.github.repos.firmware,
          owner: config.github.organization,
          job_id: githubActionsRun.id,
        }
      );

      const { artifacts } = (
        await github(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
          {
            repo: config.github.repos.firmware,
            owner: config.github.organization,
            run_id: job.data.run_id,
          }
        )
      ).data;

      const firmwareAsset = artifacts.find((artifact) =>
        artifact.name.includes("firmware")
      );

      if (!firmwareAsset) {
        return null;
      }

      return {
        id: firmwareAsset.id.toString(),
        name: firmwareAsset.name,
        url: firmwareAsset.archive_download_url,
        targets: [],
      };
    },
  },
  EdgeTxFirmwareBundle: {
    targets: (firmwareBundle, _, { firmwareStore }) =>
      firmwareStore
        .firmwareTargets(firmwareBundle.url)
        .then((firmwareTargets) =>
          firmwareTargets.map((target) => ({
            id: target.code,
            bundleUrl: firmwareBundle.url,
            base64Data: "",
            name: target.name,
          }))
        ),
    target: (firmwareBundle, { id }, { firmwareStore }) =>
      firmwareStore
        .firmwareTargets(firmwareBundle.url)
        .then((firmwareTargets) => {
          const target = firmwareTargets.find(({ code }) => code === id);
          return target
            ? {
                id: target.code,
                bundleUrl: firmwareBundle.url,
                base64Data: "",
                name: target.name,
              }
            : null;
        }),
  },
  EdgeTxFirmwareTarget: {
    base64Data: async (target, _, { firmwareStore }) => {
      const firmware = await firmwareStore.fetchFirmware(
        target.bundleUrl,
        target.id
      );
      return firmware.toString("base64");
    },
  },
};

export default {
  typeDefs,
  resolvers,
};
