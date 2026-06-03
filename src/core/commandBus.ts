type CommandHandler = (...args: any[]) => any;
const commands = new Map<string, CommandHandler>();

export function registerCommand(name: string, handler: CommandHandler) {
  commands.set(name, handler);
}

export function executeCommand<T = any>(name: string, ...args: any[]): T | undefined {
  const handler = commands.get(name);
  if (handler) return handler(...args);
  return undefined;
}

export function hasCommand(name: string): boolean {
  return commands.has(name);
}

export function clearCommands() {
  commands.clear();
}
