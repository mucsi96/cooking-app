{
  description = "cooking-app development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      # Developed exclusively on WSL (x86_64-linux).
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        # Language toolchains and CLIs. The container runtime (Podman) is a
        # distro-level prerequisite and is intentionally NOT managed here:
        # rootless Podman relies on setuid newuidmap/newgidmap helpers and
        # /etc/subuid mappings that a Nix store binary cannot provide.
        packages = [
          pkgs.temurin-bin-21   # JDK 21 (Temurin), matching the previous SDKMAN install
          pkgs.maven
          pkgs.nodejs_22        # matches the Node version used in CI
          pkgs.jq
          pkgs.kubectl
          pkgs.kubernetes-helm
          pkgs.azure-cli
        ];

        shellHook = ''
          export JAVA_HOME="${pkgs.temurin-bin-21}"
          echo "cooking-app dev shell: jdk21 (Temurin), maven, node $(node --version), jq, kubectl, helm, az"
          echo "Podman is a distro-level prerequisite (e.g. 'apt install podman' on WSL) and is not provided by this flake."
        '';
      };
    };
}
