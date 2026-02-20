{application, runner_workspace, [
    {vsn, "0.1.0"},
    {applications, [gleam_json,
                    gleam_stdlib,
                    gleeunit]},
    {description, ""},
    {modules, [runner_workspace@@main,
               solution]},
    {registered, []}
]}.
