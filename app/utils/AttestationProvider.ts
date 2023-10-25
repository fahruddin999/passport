import onchainInfo from "../../deployments/onchainInfo.json";
import GitcoinVerifierAbi from "../../deployments/abi/GitcoinVerifier.json";
import axios, { AxiosResponse } from "axios";
import { iamUrl } from "../config/stamp_config";

type AttestationProviderStatus = "enabled" | "comingSoon" | "disabled";

type BaseProviderConfig = {
  name: string;
  status: AttestationProviderStatus;
};

type EASConfig = BaseProviderConfig & {
  name: "Ethereum Attestation Service";
  easScanUrl: string;
};

type VeraxAndEASConfig = BaseProviderConfig & {
  name: "Verax + EAS";
  easScanUrl: string;
};

export type AttestationProviderConfig = EASConfig | VeraxAndEASConfig;

export interface AttestationProvider {
  name: string;
  status: AttestationProviderStatus;
  hasWebViewer: boolean;
  viewerUrl: (address: string) => string;
  verifierAddress: () => string;
  verifierAbi: () => any;
  getMultiAttestationRequest: (payload: {}) => Promise<AxiosResponse<any, any>>;
}

class BaseAttestationProvider implements AttestationProvider {
  name = "Override this class";
  status: AttestationProviderStatus;
  hasWebViewer = false;
  chainId: string;

  constructor({ chainId, status }: { chainId: string; status: AttestationProviderStatus }) {
    this.chainId = chainId;
    this.status = status;
  }

  viewerUrl(_address: string): string {
    throw new Error("No viewer, check hasWebViewer first");
  }

  onchainInfo(): any {
    if (!Object.keys(onchainInfo).includes(this.chainId)) {
      throw new Error(`No onchainInfo found for chainId ${this.chainId}`);
    }
    return onchainInfo[this.chainId as keyof typeof onchainInfo];
  }

  verifierAddress(): string {
    return this.onchainInfo().GitcoinVerifier.address;
  }

  verifierAbi(): any {
    return GitcoinVerifierAbi[this.chainId as keyof typeof GitcoinVerifierAbi];
  }

  async getMultiAttestationRequest(payload: {}): Promise<AxiosResponse<any, any>> {
    return axios.post(`${iamUrl}v0.0.0/eas/passport`, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      transformRequest: [(data: any) => JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v))],
    });
  }
}

export class EASAttestationProvider extends BaseAttestationProvider {
  name = "Ethereum Attestation Service (Score & Passport)";
  hasWebViewer = true;
  easScanUrl: string;

  constructor({
    chainId,
    status,
    easScanUrl,
  }: {
    chainId: string;
    status: AttestationProviderStatus;
    easScanUrl: string;
  }) {
    super({ status, chainId });
    this.easScanUrl = easScanUrl;
  }

  viewerUrl(address: string): string {
    return `${this.easScanUrl}/address/${address}`;
  }
}

export class VeraxAndEASAttestationProvider extends EASAttestationProvider {
  name = "Verax, Ethereum Attestation Service (Score only)";

  async getMultiAttestationRequest(payload: {}): Promise<AxiosResponse<any, any>> {
    return axios.post(`${iamUrl}v0.0.0/eas/score`, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      transformRequest: [(data: any) => JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v))],
    });
  }
}
