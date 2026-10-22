var CodexForZoteroScope = null;
var CodexForZoteroStartup = null;

function install() {}

async function startup(data) {
  if (CodexForZoteroStartup) return CodexForZoteroStartup;

  const scope = {
    Zotero,
    Services,
    Cc,
    Ci,
    Cu: Components.utils,
    ChromeUtils,
    IOUtils,
    PathUtils,
    pluginID: data.id,
    pluginVersion: data.version,
    rootURI: data.rootURI,
  };
  scope.globalThis = scope;
  for (const file of ["vendor/katex/katex.min.js", "vendor/marked/marked.umd.js", "platform.js", "license-policy.js", "licensing.js", "protocol.js", "state.js", "graphs.js", "study.js", "documents.js", "workspace.js", "resources.js", "pdf-native.js", "pdf-reader.js", "management.js", "richtext.js", "experience.js", "ui.js", "main.js", "workbench.js"]) {
    Services.scriptloader.loadSubScriptWithOptions(data.rootURI + "content/" + file, { target: scope, ignoreCache: true });
  }
  CodexForZoteroScope = scope;
  CodexForZoteroStartup = (async () => {
    try {
      await scope.CodexForZotero.startup();
      Zotero.CodexForZotero = scope.CodexForZotero;
    } catch (error) {
      await scope.CodexForZotero.shutdown().catch(e => Zotero.logError(e));
      CodexForZoteroScope = null;
      throw error;
    }
  })();
  return CodexForZoteroStartup;
}

async function shutdown() {
  await CodexForZoteroStartup?.catch(() => {});
  if (!CodexForZoteroScope) {
    CodexForZoteroStartup = null;
    return;
  }
  await CodexForZoteroScope.CodexForZotero.shutdown();
  delete Zotero.CodexForZotero;
  CodexForZoteroScope = null;
  CodexForZoteroStartup = null;
}

function uninstall() {}

function onMainWindowLoad({ window }) {
  CodexForZoteroScope?.CodexForZotero.attachWindow(window);
}
