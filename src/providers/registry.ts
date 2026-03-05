import { AgentProvider } from "../types";

export class ProviderRegistry {
  private providers = new Map<string, AgentProvider>();

  register(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  async getAvailable(): Promise<AgentProvider[]> {
    const results = await Promise.all(
      this.getAll().map(async (p) => ({
        provider: p,
        available: await p.isAvailable(),
      }))
    );
    return results.filter((r) => r.available).map((r) => r.provider);
  }

  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
  }
}
