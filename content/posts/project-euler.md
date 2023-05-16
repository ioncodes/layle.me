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

There's a thing called [_arithmetic progression_](https://en.wikipedia.org/wiki/Arithmetic_progression), although _arithmetic sequence_ seems more fitting. A sequence of numbers is a arithmetic sequence if the difference between the consecutive numbers is constant throughout the entire series. If we have a look at the an example based off of the problem (limted to  `1..15`):

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