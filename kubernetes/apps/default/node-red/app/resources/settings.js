module.exports = {
  flowFile: "flows.json",
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET,
  flowFilePretty: true,

  adminAuth: {
    type: "strategy",
    strategy: {
      name: "openidconnect",
      autoLogin: true,
      label: "Sign in with Authentik",
      icon: "fa-cloud",
      strategy: require("passport-openidconnect").Strategy,
      options: {
        // From node-red-oidc-authentik-application secret (auto-generated)
        issuer: process.env.issuerURL,
        clientID: process.env.clientID,
        clientSecret: process.env.clientSecret,
        callbackURL: process.env.redirectURL,
        // From node-red-secret (templated with Flux substitution)
        authorizationURL: process.env.NODE_RED_OIDC_AUTH_URL,
        tokenURL: process.env.NODE_RED_OIDC_TOKEN_URL,
        userInfoURL: process.env.NODE_RED_OIDC_USERINFO_URL,
        scope: ["email", "profile", "openid"],
        proxy: true,
        verify: function (issuer, profile, done) {
          done(null, profile)
        },
      },
    },
    users: function(user) {
        return Promise.resolve({ username: user, permissions: "*" });
    }
  },

  uiPort: process.env.PORT || 1880,

  diagnostics: {
    enabled: true,
    ui: true,
  },

  runtimeState: {
    enabled: false,
    ui: false,
  },

  logging: {
    console: {
      level: "info",
      metrics: false,
      audit: false,
    },
  },

  contextStorage: {
    default: {
      module: "localfilesystem",
    },
  },

  exportGlobalContextKeys: false,

  externalModules: {},

  editorTheme: {
    tours: false,

    projects: {
      enabled: false,
      workflow: {
        mode: "manual",
      },
    },

    codeEditor: {
      lib: "monaco",
      options: {},
    },
  },

  functionExternalModules: true,
  functionGlobalContext: {},

  debugMaxLength: 1000,

  mqttReconnectTime: 15000,
  serialReconnectTime: 15000,
}
