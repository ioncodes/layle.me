---
author: "Layle"
slug: "project-euler"
title: "Taking a shot at Project Euler"
summary: "Recently I found out about Project Euler and figured I'll give it a shot with the goal to learn new things about math."
tags: ["math", "project-euler"]
date: 2022-12-07T22:00:00Z
draft: true
---


I'd like to start with a quick disclaimer: I'm neither a mathematician nor did I take any classes on these topics. Please do let me know if I get something wrong or if there's a better way to solve these problems. I'll be talking about what I was able to learn from different resources online and what I was able to figure out myself.


## Problem 1: Multiples of 3 or 5

> If we list all the natural numbers below 10 that are multiples of 3 or 5, we get 3, 5, 6 and 9. The sum of these multiples is 23.  
> Find the sum of all the multiples of 3 or 5 below 1000.

Alright, this doesn't seem all too bad. We can definitely solve this by bruteforcing through the range `1..999` and checking whether the number is a multiple of 3 or 5 using the modulo operator `%` or `mod` depending on the language. If it is, we add it to the sum. If not, we move on to the next number. This is a pretty straightforward solution, but it's not very efficient. We can do better. Nonetheless, this is how we could solve this problem using Haskell:

```haskell
sum [x | x <- [1..999], x `mod` 3 == 0 || x `mod` 5 == 0]
```

There's a thing called [_arithmetic progression_](https://en.wikipedia.org/wiki/Arithmetic_progression), although _arithmetic sequence_ seems more fitting. A sequence of numbers is a arithmetic sequence if the difference between the consecutive numbers is constant throughout the entire series. If we have a look at an example based off of the problem (limted to `1..15`):

```
Multiples of 3 -> 3, 6, 9, 12, 15
Multiples of 5 -> 5, 10, 15
```

The series of multiples of 3 and 5 are arithmetic sequences. The difference between the consecutive numbers is always 3 and 5 respectively. We can use this to our advantage, but first let's have a look at the formula for a regular sequence of numbers:

$$\sum_{i=1}^{n} x_i = x_1 + x_2 + x_3 + ... + x_{n-1} + x_n$$

Where $x_i$ is the $i$th number in the sequence. Let's rewrite the formula for a sequence of `1..10` where each number is a multiple of 1:

$$\sum_{i=1}^{10} 1i = 1 + 2 + 3 + ... + 9 + 10$$

When I wrote this down for the first time I noticed something! Each term is a multiple of 1, therefore each term is equal to $i$. This doesn't sound too exciting just yet, but let's think about how we can generate a sequence that produces exclusively numbers as a multiple of 3. We can do this by multiplying each term ($i$) by 3! Now the formula looks like this:

$$\sum_{i=1}^{10} 3i = 3 + 6 + 9 + ... + 27 + 30$$

However, we are only interested in all terms between `1..10` - at least for now. This means that we must make sure the formula does not exceed 10. The question now becomes: How do we figure out how many terms (multiples!) are in the sequence for a given range?  

Since this is an arithmetic sequence, and a arithmetic sequence dictates that the difference between each term must be constant, we can simply deduce that:

$$n = \lfloor\frac{x_n}{m}\rfloor$$

Where $n$ is the number of terms in the sequence, $x_n$ (10 in our example) is the desired, biggest number and $m$ (the multiple 3) is the difference between each term. However, keep in mind that we are operating on *natural* numbers, this means $\frac{10}{3} = 3$. In math we denote `floor` functions as $\lfloor x \rfloor$ which is synonymous with `floor(x)`. Let's apply this to our example:

$$\sum_{i=1}^{\lfloor\frac{x_n}{m}\rfloor} 3i = 3 + 6 + 9$$

With this information at hand we can now go back and rewrite the formula for the sequence of multiples of 3 and 5, this time we'll use the range `1..15`:

$$S = \sum_{i=1}^{\frac{15}{3}} 3i + \sum_{i=1}^{\frac{15}{5}} 5i$$

At this point I thought I was done, however, turns out we missed a crucial step! Visualizing it helped me a lot, let's take another a look at the sequence of multiples of 3 and 5:

```
Multiples of 3 -> 3, 6, 9, 12, 15
Multiples of 5 -> 5, 10, 15
```

Do you notice something? The number 15 is a multiple of both 3 and 5. This means that we have to remove it from the sum of multiples of 5. We can do this by subtracting the sum of the multiples of 15 from $S$. Let's rewrite the formula:

$$S = \sum_{i=1}^{\frac{15}{3}} 3i + \sum_{i=1}^{\frac{15}{5}} 5i - \sum_{i=1}^{\frac{15}{15}} 15i$$

This leaves us with the following solution:

$$\sum_{i=1}^{\frac{15}{3}} 3i + \sum_{i=1}^{\frac{15}{5}} 5i - \sum_{i=1}^{\frac{15}{15}} 15i = 60$$

Which seems to be correct, let's double check using Haskell!

```haskell
Prelude> sum [x | x <- [1..15], x `mod` 3 == 0 || x `mod` 5 == 0]
60
```

We can now apply this to the original problem:

$$S = \sum_{i=1}^{\frac{999}{3}} 3i + \sum_{i=1}^{\lfloor\frac{999}{5}\rfloor} 5i - \sum_{i=1}^{\lfloor\frac{999}{15}\rfloor} 15i$$

With this in mind we can try to abstract the sum as a function, where $m$ is the multiple and $n$ is the upper bounding value (999 for the original problem):

$$f(n, m) = \sum_{i=1}^{\lfloor\frac{n}{m}\rfloor} mi$$

Or even more concise:

$$f(n, m) = m * (\lfloor\frac{\lfloor\frac{n}{m}\rfloor * (\lfloor\frac{n}{m}\rfloor + 1)}{2}\rfloor)$$

As mentioned before, we must make sure that we stay within a natural room while performing our calculations, therefore we must make sure to floor all fractals.

Let's implement this using Haskell and Julia respectively:

```haskell
ghci> sum' n m = m * (((n `div` m) * ((n `div` m) + 1)) `div` 2)
ghci> sum' 999 3 + sum' 999 5 - sum' 999 15
233168
```

```julia
julia> sum(n, m) = m * (((n ÷ m) * ((n ÷ m) + 1)) ÷ 2)
sum (generic function with 1 method)

julia> sum(999, 3) + sum(999, 5) - sum(999, 15)
233168
```


## Problem 2: Even Fibonacci numbers

> Each new term in the Fibonacci sequence is generated by adding the previous two terms. By starting with 1 and 2, the first 10 terms will be:
> 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ...
> By considering the terms in the Fibonacci sequence whose values do not exceed four million, find the sum of the even-valued terms.


Just like problem 1, this problem can be solved using bruteforce by recursion or using an naive, iterative approach. Let's have a look at a recursive approach. We know that each term $n$ in the Fibonacci sequence is the sum of the two terms before $n$. This gives us the following formula:

$$f(n) = f(n-1) + f(n-2)$$

Let's look at a slightly longer sequence:

```haskell
ghci> fib a b = a:fib b (a+b)
ghci> take 40 $ fib 1 1
[1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711,28657,46368,75025,121393,196418,317811,514229,832040,1346269,2178309,3524578,5702887,9227465,14930352,24157817,39088169,63245986,102334155]
```

Taking the naive approach is actually quite doable in this case as we only have to sum all even numbers up until $n=3524578$ (keep in mind, we must only sum all terms that are smaller or equal 4'000'000), that's just 11 even numbers in a pool of 33! Taking the naive approach left me quiet unsatisfied and therefore I went on to figure out a faster way to solve the problem.

I spent some time trying to figure out how I can break down the problem into smaller problems and optimize those. I eventually managed to figure out a solution that's faster, however, I'm not sure if it's the fastest possible solution to this problem. If you there's a better solution, please do let me know!

Anyways, let's talk about [_differential equations_](https://en.wikipedia.org/wiki/Differential_equation). Differential equations are a way of expressing how something changes over time or a series. To deliver a real world example: compound interest. Using differential equations we can calculate the change in an investment over time using a specific rate. Anyways, back to the problem.

If we have another look at our $f(n)$ function, we notice that $n$ depends on two unknown variables, formerly $n-1$ and $n-2$. This type of issue can be tackled using homogeneous second order differential equations. What does a differential equation look like? Well, turns it's slightly different to an algebraic equations in the sense that it's comprised of functions and their derivatives and optionally constants. The function in our case is `f`. A 2nd order differential equation defines that we have 2 derivates of function `f`. Let's rewrite it into a more legible form:

$$f(n+2) = f(n+1) + f(n)$$

or

$$f(n+2) - f(n+1) - f(n) = 0$$

Now let's compare that to a standard 2nd order differential equation:

$$ay'' + by' + cy = 0$$

Looks about right! Now, apparently, differential equations are about making "educated guesses" (whatever that means) in order to try to solve towards the equations constants. I'm not quite sure if I got this part right - if someone knows, please do let me know! Even if we don't quite understand what that means, we are still able to use the equation to our advantage. The common consensus to solve this particular type of equation is to apparently assume $y=k^2$. Let's give it a shot:

$$ak^{n+2} - bk^{n+1} - ck^n = 0$$

Let's focus on $k$ for now. We can easily spot that we can divide by $k^n$, which leaves us with:

$$k^2 - k - 1 = 0$$

I instantly recognized this pattern from highschool as [quadratic formula]()! Since we'll be operating with 2 different values I decided to use the term $\phi$ as it holds a similar purpose in compiler design, especially the LLVM-enthusiasts may recognize it from the SSA form. In SSA terminology a phi node is a value that depends on the predecessor of the current (basic) block.

$$
\begin{aligned}
\phi_{1,2} &= \frac{-1 \pm \sqrt{1^2 - (4\*1\*-1)}}{2\*1} \cr
           &= \frac{-1 \pm \sqrt{1 + 4}}{2} \cr
           &= \frac{-1 \pm \sqrt{5}}{2}
\end{aligned}
$$

That gives our new function $f(n)$:

$$f(n) = a*\phi_1^n + b*\phi_2^n$$

From here on out it's just solving for $a$ and $b$ and putting everything together as a two equation system; we are almost there! Let's create 2 equations for $n=0$ and $n=1$. The first one is a no-brainer as any term to the power of 0 is just 1.

$$
\begin{aligned}
f(0) &= a(\frac{1 + \sqrt{5}}{2})^0 + b(\frac{1 - \sqrt{5}}{2})^0 \cr
     &= a + b
\end{aligned}
$$

Let's keep in mind that if $a+b=0$ that means $a=-b$. It will come in handy soon. Let's move on to $n=1$. This one's a little trickier. Power of 1 is equivalent to not doing anything at all, however, that makes solving the equation trickier. Let's have a look:

$$
\begin{aligned}
f(1) &= a(\frac{1 + \sqrt{5}}{2})^1 + b(\frac{1 - \sqrt{5}}{2})^1 \cr
     &= a(\frac{1 + \sqrt{5}}{2}) + b(\frac{1 - \sqrt{5}}{2}) \cr
     &= \frac{(a + b) + (a - b)\sqrt{5}}{2}
\end{aligned}
$$

Now, remember that $a+b=0$?

$$
\begin{aligned}
1 &= \frac{(a - b)\sqrt{5}}{2} \cr
2 &= (a - b)\sqrt{5} \cr
\frac{2}{\sqrt{5}} &= a - b
\end{aligned}
$$

Now that we shorted the equations we can make a two equation system:

$$
\begin{aligned}
a + b &= 0 \cr
a - b &= \frac{2}{\sqrt{5}}
\end{aligned}
$$

Which we can now solve easily:

$$
\begin{aligned}
2a &= \frac{2}{\sqrt{5}} \cr
a &= \frac{1}{\sqrt{5}}
\end{aligned}
$$

Remember when I said that $a=-b$? Well if $a=\frac{1}{\sqrt{5}}$ then that must mean $b=-\frac{1}{\sqrt{5}}$. This gives us the final formula:

$$f(n) = \frac{1}{\sqrt{5}}(\frac{1 + \sqrt{5}}{2})^n - \frac{1}{\sqrt{5}}(\frac{1 - \sqrt{5}}{2})^n$$

Great! We managed to get a concrete formula that calculates the nth Fibonacci number. Now let's tend to the actual problem. We must sum all even numbers up until we encounter a number bigger than 4'000'000. Let's look for some patterns in the Fibonacci sequence:

```
[1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711,28657,46368,75025,121393,196418,317811,514229,832040,1346269,2178309,3524578,...]
```

We notice that every 3rd number is even! We also notice that the 11th even number is the last number smaller or equal than 4'000'000. This means we can spare ourselves from implementing a `if` / `else` check. Let's have a look at what a sum function $S$ would look like where $n$ is the last even number we are looking for:

$$S(n) = \sum_{i=0}^{n} 3 i = \frac{1}{\sqrt{5}}(\frac{1 + \sqrt{5}}{2})^n - \frac{1}{\sqrt{5}}(\frac{1 - \sqrt{5}}{2})^n$$

Implementing this in Julia is an easy task.

```julia
julia> fib(n) = trunc(Int, ((1 / √5) * ((1 + √5) / 2) ^ n) - ((1 / √5) * ((1 - √5) / 2) ^ n))
fib (generic function with 1 method)

julia> map(x -> fib(x*3), 1:11)
11-element Vector{Int64}:
       2
       8
      34
     144
     610
    2584
   10946
   46368
  196418
  832040
 3524578

julia> sum(map(x -> fib(x*3), 1:11))
4613732
```

And it turns out it's quite fast too (~ 2-3 microseconds)!

```julia
julia> s() = sum(map(x -> fib(x*3), 1:11))
s (generic function with 1 method)

julia> @time s()
  0.000003 seconds (1 allocation: 144 bytes)
4613732
```