import { ErrorMapper } from "utils/ErrorMapper";
import { GameManager } from "GameManager";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {

  console.log(`<span style='color:green'>Game tick ${Game.time}</span>`);
  const manager = new GameManager();

  manager.run();

});
