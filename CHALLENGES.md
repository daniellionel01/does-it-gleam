# Challenges

## Level 1

### FizzBuzz

````
### Description
Write a function that returns the appropriate string for a given number:
- "FizzBuzz" if divisible by 15
- "Fizz" if divisible by 3 (but not 15)
- "Buzz" if divisible by 5 (but not 15)
- The number as a string otherwise

### Function Signature
```gleam
pub fn fizzbuzz(n: Int) -> String
```

### Example Usage
```gleam
fizzbuzz(3)   // Returns "Fizz"
fizzbuzz(5)   // Returns "Buzz"
fizzbuzz(15)  // Returns "FizzBuzz"
fizzbuzz(7)   // Returns "7"
```
````

**Verification:**
```gleam
fizzbuzz(3) == "Fizz"
fizzbuzz(5) == "Buzz"
fizzbuzz(15) == "FizzBuzz"
fizzbuzz(7) == "7"
fizzbuzz(30) == "FizzBuzz"
fizzbuzz(1) == "1"
```

---

### Fibonacci

```
### Description
Write a function that returns the nth Fibonacci number (0-indexed).
- fib(0) = 0
- fib(1) = 1
- fib(n) = fib(n-1) + fib(n-2)

### Function Signature
```gleam
pub fn fib(n: Int) -> Int
```

### Example Usage
```gleam
fib(0)   // Returns 0
fib(1)   // Returns 1
fib(10)  // Returns 55
```
```

**Verification:**
```gleam
fib(0) == 0
fib(1) == 1
fib(2) == 1
fib(10) == 55
fib(15) == 610
fib(20) == 6765
```

---

### Factorial

```
### Description
Write a factorial function that calculates n! (n factorial).
- factorial(0) = 1
- factorial(n) = n * factorial(n-1)

### Function Signature
```gleam
pub fn factorial(n: Int) -> Int
```

### Example Usage
```gleam
factorial(0)   // Returns 1
factorial(5)   // Returns 120
factorial(10)  // Returns 3628800
```
```

**Verification:**
```gleam
factorial(0) == 1
factorial(1) == 1
factorial(5) == 120
factorial(10) == 3_628_800
factorial(7) == 5040
```

---

### String Reverse

```
### Description
Write a function that reverses a string. Use the `gleam/string` module.

### Function Signature
```gleam
pub fn reverse_string(s: String) -> String
```

### Example Usage
```gleam
reverse_string("hello")  // Returns "olleh"
reverse_string("Gleam")  // Returns "maelG"
reverse_string("")       // Returns ""
```
```

**Verification:**
```gleam
reverse_string("hello") == "olleh"
reverse_string("") == ""
reverse_string("Gleam") == "maelG"
reverse_string("a") == "a"
reverse_string("racecar") == "racecar"
```

---

## Level 2

### Tuple Swap

```
### Description
Write a function that swaps the elements of a 2-tuple.

### Function Signature
```gleam
pub fn swap(tuple: #(a, b)) -> #(b, a)
```

### Example Usage
```gleam
swap(#(1, "hello"))     // Returns #("hello", 1)
swap(#(True, False))    // Returns #(False, True)
swap(#(1.5, 2))         // Returns #(2, 1.5)
```
```

**Verification:**
```gleam
swap(#(1, "hello")) == #("hello", 1)
swap(#(True, False)) == #(False, True)
swap(#(1.5, 2)) == #(2, 1.5)
swap(#("a", "b")) == #("b", "a")
```

---

### Greetings

```
### Description
Define a `Person` record with `name` (String) and `age` (Int).
Write a `greet` function that returns a greeting for a person:
- If age < 18: "Hello, young {name}!"
- If age >= 18: "Hello, {name}!"

### Function Signature
```gleam
pub type Person {
  Person(name: String, age: Int)
}

pub fn greet(person: Person) -> String
```

### Example Usage
```gleam
let alice = Person("Alice", 25)
greet(alice)  // Returns "Hello, Alice!"

let bob = Person("Bob", 12)
greet(bob)    // Returns "Hello, young Bob!"
```
```

**Verification:**
```gleam
greet(Person("Alice", 25)) == "Hello, Alice!"
greet(Person("Bob", 12)) == "Hello, young Bob!"
greet(Person("Charlie", 18)) == "Hello, Charlie!"
greet(Person("Diana", 17)) == "Hello, young Diana!"
greet(Person("Eve", 0)) == "Hello, young Eve!"
```

---

### Second List Item

```
### Description
Write a function that returns the second element of a list.
Return `Ok(value)` if it exists, `Error(Nil)` otherwise.

### Function Signature
```gleam
pub fn second(list: List(a)) -> Result(a, Nil)
```

### Example Usage
```gleam
second([1, 2, 3])     // Returns Ok(2)
second(["a", "b"])    // Returns Ok("b")
second([1])           // Returns Error(Nil)
second([])            // Returns Error(Nil)
```
```

**Verification:**
```gleam
second([1, 2, 3]) == Ok(2)
second(["a", "b"]) == Ok("b")
second([1]) == Error(Nil)
second([]) == Error(Nil)
second([1, 2]) == Ok(2)
second([True, False, True]) == Ok(False)
```

---

### List Sum

```
### Description
Write a function that sums all integers in a list.
Return 0 for an empty list.

### Function Signature
```gleam
pub fn sum(list: List(Int)) -> Int
```

### Example Usage
```gleam
sum([1, 2, 3, 4, 5])  // Returns 15
sum([])               // Returns 0
sum([10, -5, 3])      // Returns 8
```
```

**Verification:**
```gleam
sum([1, 2, 3, 4, 5]) == 15
sum([]) == 0
sum([10, -5, 3]) == 8
sum([0, 0, 0]) == 0
sum([-1, -2, -3]) == -6
```

---

### List Product

```
### Description
Write a function that multiplies all integers in a list.
Return 1 for an empty list.

### Function Signature
```gleam
pub fn product(list: List(Int)) -> Int
```

### Example Usage
```gleam
product([1, 2, 3, 4])  // Returns 24
product([])            // Returns 1
product([2, 3, 5])     // Returns 30
```
```

**Verification:**
```gleam
product([1, 2, 3, 4]) == 24
product([]) == 1
product([2, 3, 5]) == 30
product([5]) == 5
product([2, 0, 3]) == 0
product([-1, 2, 3]) == -6
```

---

### Shape Area

```
### Description
Define a `Shape` type with three variants:
- `Circle(radius: Float)`
- `Rectangle(width: Float, height: Float)`
- `Square(side: Float)`

Write an `area` function that calculates the area of any shape.
Use `3.14159` as the value for pi.

### Function Signature
```gleam
pub type Shape {
  Circle(Float)
  Rectangle(Float, Float)
  Square(Float)
}

pub fn area(shape: Shape) -> Float
```

### Example Usage
```gleam
area(Circle(1.0))           // Returns 3.14159
area(Rectangle(3.0, 4.0))   // Returns 12.0
area(Square(5.0))           // Returns 25.0
```
```

**Verification:**
```gleam
area(Circle(1.0)) == 3.14159
area(Circle(2.0)) == 12.56636
area(Rectangle(3.0, 4.0)) == 12.0
area(Rectangle(1.5, 2.0)) == 3.0
area(Square(5.0)) == 25.0
area(Square(0.5)) == 0.25
```

---

## Level 3

### Matrix Multiplication

```
### Description
Represent matrices as `List(List(Int))` where each inner list is a row.
Write a function that multiplies two matrices if dimensions are compatible.
Return `Error(Nil)` if multiplication is not possible (columns of A != rows of B).

### Function Signature
```gleam
pub fn matrix_multiply(
  a: List(List(Int)),
  b: List(List(Int))
) -> Result(List(List(Int)), Nil)
```

### Example Usage
```gleam
// 2x3 * 3x2 = 2x2
matrix_multiply(
  [[1, 2, 3], [4, 5, 6]],
  [[7, 8], [9, 10], [11, 12]]
)
// Returns Ok([[58, 64], [139, 154]])

// Incompatible dimensions (2x1 * 2x1)
matrix_multiply([[1, 2]], [[1, 2]])
// Returns Error(Nil)
```
```

**Verification:**
```gleam
matrix_multiply([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]]) == Ok([[58, 64], [139, 154]])
matrix_multiply([[1, 2]], [[1, 2]]) == Error(Nil)
matrix_multiply([[1, 2], [3, 4]], [[5, 6], [7, 8]]) == Ok([[19, 22], [43, 50]])
matrix_multiply([[1]], [[2]]) == Ok([[2]])
matrix_multiply([], [[1]]) == Error(Nil)
matrix_multiply([[1, 2, 3]], [[1], [2], [3]]) == Ok([[14]])
```

---

### Quicksort

```
### Description
Implement quicksort for a list of integers.
Choose the first element as the pivot.

### Function Signature
```gleam
pub fn quicksort(list: List(Int)) -> List(Int)
```

### Example Usage
```gleam
quicksort([3, 1, 4, 1, 5, 9, 2, 6])  // Returns [1, 1, 2, 3, 4, 5, 6, 9]
quicksort([])                        // Returns []
quicksort([1])                       // Returns [1]
```
```

**Verification:**
```gleam
quicksort([3, 1, 4, 1, 5, 9, 2, 6]) == [1, 1, 2, 3, 4, 5, 6, 9]
quicksort([]) == []
quicksort([1]) == [1]
quicksort([5, 4, 3, 2, 1]) == [1, 2, 3, 4, 5]
quicksort([1, 1, 1, 1]) == [1, 1, 1, 1]
quicksort([1, 2, 3, 4, 5]) == [1, 2, 3, 4, 5]
```

---

### Prime Check

```
### Description
Write a function that determines if a positive integer is prime.
A prime number is greater than 1 and only divisible by 1 and itself.
Return `False` for numbers less than 2.

### Function Signature
```gleam
pub fn is_prime(n: Int) -> Bool
```

### Example Usage
```gleam
is_prime(2)   // Returns True
is_prime(17)  // Returns True
is_prime(1)   // Returns False
is_prime(4)   // Returns False
```
```

**Verification:**
```gleam
is_prime(2) == True
is_prime(3) == True
is_prime(17) == True
is_prime(97) == True
is_prime(1) == False
is_prime(0) == False
is_prime(4) == False
is_prime(15) == False
is_prime(100) == False
is_prime(7919) == True
```

---

## Level 4

### JSON Encoder

```
### Description
Given the `User` type below, write a JSON encoder using `gleam/json`.
The output should be a JSON object with "name" and "age" fields.

### Function Signature
```gleam
import gleam/json

pub type User {
  User(name: String, age: Int)
}

pub fn encode_user(user: User) -> String
```

### Example Usage
```gleam
encode_user(User("Alice", 30))  // Returns {"name":"Alice","age":30}
encode_user(User("Bob", 25))    // Returns {"name":"Bob","age":25}
```
```

**Verification:**
```gleam
encode_user(User("Alice", 30)) == "{\"name\":\"Alice\",\"age\":30}"
encode_user(User("Bob", 25)) == "{\"name\":\"Bob\",\"age\":25}"
encode_user(User("Charlie", 0)) == "{\"name\":\"Charlie\",\"age\":0}"
```

---

### JSON Decoder

```
### Description
Write a JSON decoder for the `User` type using `gleam/dynamic/decode`.
The decoder should parse a JSON object with "name" (string) and "age" (int) fields.

### Function Signature
```gleam
import gleam/dynamic/decode

pub type User {
  User(name: String, age: Int)
}

pub fn user_decoder() -> decode.Decoder(User)
```

### Example Usage
```gleam
// When applied to the JSON string {"name":"Alice","age":30}
// The decoder should produce Ok(User("Alice", 30))
```
```

**Verification:**
```gleam
// Test with: decode.run(user_decoder(), json.parse("{\"name\":\"Alice\",\"age\":30}"))
// Expected: Ok(User("Alice", 30))

// Test with: decode.run(user_decoder(), json.parse("{\"name\":\"Bob\",\"age\":25}"))
// Expected: Ok(User("Bob", 25))

// Test with invalid JSON: decode.run(user_decoder(), json.parse("{\"name\":\"Alice\"}"))
// Expected: Error(...)
```

---

### Decode Nested JSON

```
### Description
Write a decoder for a nested JSON structure.
Parse JSON like: `{"user": {"name": "...", "age": ...}, "active": true}`
into the `Account` type below.

### Function Signature
```gleam
import gleam/dynamic/decode

pub type User {
  User(name: String, age: Int)
}

pub type Account {
  Account(user: User, active: Bool)
}

pub fn account_decoder() -> decode.Decoder(Account)
```

### Example Usage
```gleam
// When applied to: {"user":{"name":"Alice","age":30},"active":true}
// The decoder should produce Ok(Account(User("Alice", 30), True))
```
```

**Verification:**
```gleam
// Test with: decode.run(account_decoder(), json.parse("{\"user\":{\"name\":\"Alice\",\"age\":30},\"active\":true}"))
// Expected: Ok(Account(User("Alice", 30), True))

// Test with: decode.run(account_decoder(), json.parse("{\"user\":{\"name\":\"Bob\",\"age\":25},\"active\":false}"))
// Expected: Ok(Account(User("Bob", 25), False))
```

---

## Level 5

### AoC Day 1 Style: Calibration Values

```
### Description
Extract calibration values from strings containing digits.
For each string, find the first and last digit, then combine them into a two-digit number.
If there's only one digit, use it for both first and last.
If there are no digits, return 0.

Write two functions:
- `extract_calibration_value` for a single string
- `sum_calibration_values` to sum all values from a list

### Function Signature
```gleam
pub fn extract_calibration_value(s: String) -> Int

pub fn sum_calibration_values(lines: List(String)) -> Int
```

### Example Usage
```gleam
extract_calibration_value("a1b2c3d4e5")  // Returns 15 (first: 1, last: 5)
extract_calibration_value("treb7uchet")  // Returns 77 (first: 7, last: 7)
extract_calibration_value("abc")         // Returns 0 (no digits)

sum_calibration_values(["a1b2c3d4e5", "treb7uchet"])  // Returns 92
```
```

**Verification:**
```gleam
extract_calibration_value("a1b2c3d4e5") == 15
extract_calibration_value("treb7uchet") == 77
extract_calibration_value("abc") == 0
extract_calibration_value("1abc2") == 12
extract_calibration_value("pqr3stu8vwx") == 38
extract_calibration_value("a1b2c3d4e5f6g7h8i9") == 19
sum_calibration_values(["a1b2c3d4e5", "treb7uchet"]) == 92
sum_calibration_values(["1abc2", "pqr3stu8vwx", "a1b2c3d4e5f"]) == 12 + 38 + 15
```

---

### AoC Day 2 Style: Rock Paper Scissors

```
### Description
Simulate a Rock Paper Scissors tournament.
- Opponent plays: A = Rock, B = Paper, C = Scissors
- Player plays: X = Rock, Y = Paper, Z = Scissors

Score calculation:
- Shape score: Rock = 1, Paper = 2, Scissors = 3
- Outcome score: Loss = 0, Draw = 3, Win = 6
- Total = Shape score + Outcome score

Write two functions:
- `round_score` to calculate score for a single round
- `total_score` to sum scores across all rounds

### Function Signature
```gleam
pub fn round_score(opponent: String, player: String) -> Int

pub fn total_score(rounds: List(#(String, String))) -> Int
```

### Example Usage
```gleam
round_score("A", "Y")  // Returns 8 (Paper=2 beats Rock, Win=6)
round_score("B", "X")  // Returns 1 (Rock=1 loses to Paper, Loss=0)
round_score("C", "Z")  // Returns 6 (Scissors=3 draws, Draw=3)

total_score([#("A", "Y"), #("B", "X"), #("C", "Z")])  // Returns 15
```
```

**Verification:**
```gleam
round_score("A", "Y") == 8   // Paper(2) beats Rock, Win(6): 2 + 6 = 8
round_score("B", "X") == 1   // Rock(1) loses to Paper, Loss(0): 1 + 0 = 1
round_score("C", "Z") == 6   // Scissors(3) draws, Draw(3): 3 + 3 = 6
round_score("A", "X") == 4   // Rock(1) draws Rock, Draw(3): 1 + 3 = 4
round_score("A", "Z") == 3   // Scissors(3) loses to Rock, Loss(0): 3 + 0 = 3
round_score("B", "Y") == 5   // Paper(2) draws Paper, Draw(3): 2 + 3 = 5
round_score("B", "Z") == 9   // Scissors(3) beats Paper, Win(6): 3 + 6 = 9
round_score("C", "X") == 7   // Rock(1) beats Scissors, Win(6): 1 + 6 = 7
round_score("C", "Y") == 2   // Paper(2) loses to Scissors, Loss(0): 2 + 0 = 2
total_score([#("A", "Y"), #("B", "X"), #("C", "Z")]) == 15
total_score([#("A", "Y"), #("B", "X"), #("C", "Z"), #("A", "X"), #("B", "Y")]) == 24
```

---

### Binary Search

```
### Description
Implement binary search on a sorted list of integers.
Return `Ok(index)` if the target is found, `Error(Nil)` if not found.
The list is 0-indexed and sorted in ascending order.

### Function Signature
```gleam
pub fn binary_search(list: List(Int), target: Int) -> Result(Int, Nil)
```

### Example Usage
```gleam
binary_search([1, 3, 5, 7, 9], 5)   // Returns Ok(2)
binary_search([1, 3, 5, 7, 9], 6)   // Returns Error(Nil)
binary_search([], 1)                // Returns Error(Nil)
binary_search([1, 2, 3, 4, 5], 1)   // Returns Ok(0)
```
```

**Verification:**
```gleam
binary_search([1, 3, 5, 7, 9], 5) == Ok(2)
binary_search([1, 3, 5, 7, 9], 6) == Error(Nil)
binary_search([], 1) == Error(Nil)
binary_search([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10) == Ok(9)
binary_search([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1) == Ok(0)
binary_search([1, 2, 3, 4, 5], 5) == Ok(4)
binary_search([1, 2, 3, 4, 5], 0) == Error(Nil)
binary_search([2], 2) == Ok(0)
binary_search([2], 1) == Error(Nil)
```

---

## Level 6

### Pipeline Processing

```
### Description
Using Gleam's pipeline operator `|>`, process a list of numbers through multiple steps:
1. Filter out negative numbers (keep >= 0)
2. Double each number
3. Keep only even numbers
4. Sum the result

Write a single function that chains these operations.

### Function Signature
```gleam
pub fn process(numbers: List(Int)) -> Int
```

### Example Usage
```gleam
process([1, -2, 3, 4, -5, 6])  // Returns 28
// Step by step:
// Filter negatives: [1, 3, 4, 6]
// Double: [2, 6, 8, 12]
// Keep even: [2, 6, 8, 12] (all even)
// Sum: 28

process([-1, -2, -3])  // Returns 0
```
```

**Verification:**
```gleam
process([1, -2, 3, 4, -5, 6]) == 28
process([-1, -2, -3]) == 0
process([]) == 0
process([0, 1, 2, 3]) == 8        // [0, 1, 2, 3] -> [0, 2, 4, 6] -> [0, 2, 4, 6] -> 12
process([1, 3, 5]) == 24          // [1, 3, 5] -> [2, 6, 10] -> [2, 6, 10] -> 18
process([-1, 2, -3, 4]) == 12     // [2, 4] -> [4, 8] -> [4, 8] -> 12
```

---

### Dict Operations

```
### Description
Write a function that counts occurrences of each element in a list.
Return a `Dict` mapping each unique element to its count.

### Function Signature
```gleam
import gleam/dict

pub fn count_occurrences(list: List(a)) -> dict.Dict(a, Int)
```

### Example Usage
```gleam
count_occurrences([1, 2, 2, 3, 3, 3])
// Returns dict with: {1: 1, 2: 2, 3: 3}

count_occurrences(["a", "b", "a", "a", "c"])
// Returns dict with: {"a": 3, "b": 1, "c": 1}
```
```

**Verification:**
```gleam
let d1 = count_occurrences([1, 2, 2, 3, 3, 3])
dict.get(d1, 1) == Ok(1)
dict.get(d1, 2) == Ok(2)
dict.get(d1, 3) == Ok(3)

let d2 = count_occurrences([])
dict.size(d2) == 0

let d3 = count_occurrences(["a", "b", "a", "a", "c"])
dict.get(d3, "a") == Ok(3)
dict.get(d3, "b") == Ok(1)
dict.get(d3, "c") == Ok(1)

let d4 = count_occurrences([1, 1, 1, 1])
dict.get(d4, 1) == Ok(4)
```
