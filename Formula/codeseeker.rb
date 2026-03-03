class Codeseeker < Formula
  desc "Graph-powered code intelligence for Claude Code and AI assistants"
  homepage "https://github.com/jghiringhelli/codeseeker"
  url "https://registry.npmjs.org/codeseeker/-/codeseeker-1.11.2.tgz"
  sha256 "83c01df52ea2f5c231617d9853a794ea5e27443f92702e4186f0f4a13e573345"
  license "MIT"

  depends_on "node@18"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/codeseeker", "--version"
  end

  def caveats
    <<~EOS
      CodeSeeker is now installed!

      Quick start:
        1. cd your-project
        2. codeseeker install --vscode    # or --cursor, --windsurf
        3. Restart your IDE

      Verify installation:
        Ask your AI assistant: "What CodeSeeker tools do you have?"

      Documentation: https://github.com/jghiringhelli/codeseeker#readme
    EOS
  end
end
