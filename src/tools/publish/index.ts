import { ConsolePublisher, XPublisher, type Publisher } from "../../core/publish/publisher";
import { NewsletterPublisher } from "./newsletter";

/**
 * Bulaveur's publisher resolver — extends the core channels (x, console) with the
 * newsletter channel. The approval endpoint uses this to dispatch by payload.channel.
 */
export function resolvePublisher(channel: string): Publisher {
  switch (channel) {
    case "x":
      return new XPublisher();
    case "newsletter":
      return new NewsletterPublisher();
    case "console":
      return new ConsolePublisher();
    default:
      throw new Error(`No publisher for channel "${channel}"`);
  }
}
