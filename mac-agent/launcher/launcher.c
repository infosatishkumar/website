/*
 * Native launcher for the agent's .app bundle.
 *
 * macOS only shows the "allow microphone" prompt (and lists the app under
 * Privacy & Security) for a real executable inside a signed app bundle, not for
 * a shell script. This tiny program is that executable: it starts the Python
 * agent as a child process and waits. Child processes inherit the app as their
 * "responsible" process, so macOS asks "Karishma wants to use the microphone"
 * and remembers the answer for the app.
 *
 * The project folder is read from Contents/Resources/agent_root.
 * Build: see build.sh (prebuilt binaries are committed next to this file).
 */
#include <fcntl.h>
#include <libgen.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <signal.h>
#include <spawn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;
static pid_t child = 0;

static void forward(int sig) {
    if (child > 0) kill(child, sig);
}

int main(void) {
    char exe[PATH_MAX];
    uint32_t size = sizeof(exe);
    if (_NSGetExecutablePath(exe, &size) != 0) return 1;

    /* .../X.app/Contents/MacOS/launcher -> .../X.app/Contents/Resources/agent_root */
    char exe_copy[PATH_MAX];
    strncpy(exe_copy, exe, sizeof(exe_copy) - 1);
    exe_copy[sizeof(exe_copy) - 1] = '\0';
    char conf[PATH_MAX];
    snprintf(conf, sizeof(conf), "%s/../Resources/agent_root", dirname(exe_copy));

    char root[PATH_MAX] = {0};
    FILE *f = fopen(conf, "r");
    if (!f || !fgets(root, sizeof(root), f)) return 2;
    fclose(f);
    root[strcspn(root, "\r\n")] = '\0';
    if (chdir(root) != 0) return 3;

    char python[PATH_MAX];
    snprintf(python, sizeof(python), "%s/.venv/bin/python", root);

    const char *old_path = getenv("PATH");
    char path[4096];
    snprintf(path, sizeof(path), "/opt/homebrew/bin:/usr/local/bin:%s", old_path ? old_path : "/usr/bin:/bin");
    setenv("PATH", path, 1);
    setenv("PYTHONUNBUFFERED", "1", 1);

    /* Logs go to ~/Library/Logs/AI-Agent.log */
    const char *home = getenv("HOME");
    char log[PATH_MAX];
    snprintf(log, sizeof(log), "%s/Library/Logs/AI-Agent.log", home ? home : "/tmp");
    posix_spawn_file_actions_t actions;
    posix_spawn_file_actions_init(&actions);
    posix_spawn_file_actions_addopen(&actions, STDOUT_FILENO, log, O_WRONLY | O_CREAT | O_APPEND, 0644);
    posix_spawn_file_actions_adddup2(&actions, STDOUT_FILENO, STDERR_FILENO);

    char *args[] = {python, "-m", "agent.main", NULL};
    if (posix_spawn(&child, python, &actions, NULL, args, environ) != 0) return 4;

    signal(SIGTERM, forward);
    signal(SIGINT, forward);
    signal(SIGHUP, forward);

    int status = 0;
    while (waitpid(child, &status, 0) < 0) {
    }
    return WIFEXITED(status) ? WEXITSTATUS(status) : 0;
}
