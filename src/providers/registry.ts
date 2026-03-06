import { AgentProvider } from "../types";

export class ProviderRegistry {
  private providers = new Map<string, AgentProvider>();

  register(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
  }
}
