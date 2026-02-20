-module(solution).
-compile([no_auto_import, nowarn_unused_vars, nowarn_unused_function, nowarn_nomatch, inline]).
-define(FILEPATH, "src/solution.gleam").
-export([placeholder/0]).

-file("src/solution.gleam", 1).
-spec placeholder() -> integer().
placeholder() ->
    0.
