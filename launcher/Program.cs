using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace GammaCalc.Launcher
{
    internal static class Program
    {
        private const int Port = 5174;

        [STAThread]
        private static int Main()
        {
            string appRoot = AppDomain.CurrentDomain.BaseDirectory;
            string serverPath = Path.Combine(appRoot, "server.mjs");
            string bundledNode = Path.Combine(appRoot, "runtime", "node.exe");
            string nodePath = File.Exists(bundledNode) ? bundledNode : "node";
            string appUrl = "http://127.0.0.1:" + Port + "/";

            if (!File.Exists(serverPath))
            {
                ShowError("Gamma Calc could not find server.mjs next to GammaCalc.exe.\n\nExpected:\n" + serverPath);
                return 1;
            }

            if (!IsServerReady(appUrl))
            {
                StartServer(nodePath, serverPath, appRoot);
                if (!WaitForServer(appUrl, TimeSpan.FromSeconds(10)))
                {
                    ShowError("Gamma Calc could not start the local app server. Check that the folder is writable and port 5174 is free.");
                    return 1;
                }
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = appUrl,
                UseShellExecute = true
            });

            return 0;
        }

        private static void StartServer(string nodePath, string serverPath, string appRoot)
        {
            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + serverPath + "\"",
                WorkingDirectory = appRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            startInfo.EnvironmentVariables["GAMMA_CALC_HOST"] = "127.0.0.1";
            startInfo.EnvironmentVariables["GAMMA_CALC_PORT"] = Port.ToString();

            Process.Start(startInfo);
        }

        private static bool WaitForServer(string appUrl, TimeSpan timeout)
        {
            DateTime stopAt = DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow < stopAt)
            {
                if (IsServerReady(appUrl)) return true;
                Thread.Sleep(250);
            }
            return false;
        }

        private static bool IsServerReady(string appUrl)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(appUrl + "api/status");
                request.Timeout = 1000;
                request.ReadWriteTimeout = 1000;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void ShowError(string message)
        {
            MessageBox.Show(message, "Gamma Calc", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
