import { readDirectory } from "../server/directory.ts";
import { createDirectoryHandler } from "../server/handler.ts";

export default { fetch: createDirectoryHandler(readDirectory) };
