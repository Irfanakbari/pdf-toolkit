"use client"

import NextLink from "next/link"
import { useMemo, useState } from "react"
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Image,
  Link,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react"

import { tools, type ToolCategory } from "@/lib/tools"

type Filter = "all" | ToolCategory

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All Tools" },
  { value: "organize", label: "Organize PDF" },
  { value: "convert", label: "Convert PDF" },
  { value: "optimize", label: "Optimize PDF" },
  { value: "security", label: "PDF Security" },
]

const shortcuts = ["merge", "split", "compress", "excel-to-pdf", "image-to-pdf", "organize"]

export function HomeMenu() {
  const [filter, setFilter] = useState<Filter>("all")
  const visibleTools = useMemo(
    () => tools.filter((tool) => filter === "all" || tool.category === filter),
    [filter],
  )

  return (
    <Box flex="1" display="flex" flexDirection="column" bg="bg.subtle">
      <Box as="header" bg="bg.panel" borderBottomWidth="1px" position="sticky" top="0" zIndex="sticky">
        <Container maxW="8xl" px={{ base: "4", md: "6", xl: "8" }}>
          <Flex minH={{ base: "16", lg: "18" }} align="center" justify="space-between" gap="6">
            <Link asChild flexShrink="0" _focusVisible={{ outline: "2px solid", outlineColor: "blue.focusRing" }}>
              <NextLink href="/" aria-label="VUTEQ INDONESIA PDF Toolkit">
                <Image
                  src="/pdf-tools/brand/vuteq-logo.png"
                  alt="VUTEQ INDONESIA"
                  width={{ base: "28", md: "36" }}
                  height="auto"
                />
              </NextLink>
            </Link>

            <HStack
              as="nav"
              aria-label="Main tools"
              gap={{ base: "1", lg: "2" }}
              overflowX="auto"
              flex="1"
              justify={{ base: "start", lg: "center" }}
              scrollbar="hidden"
              display={{ base: "none", md: "flex" }}
            >
              {shortcuts.map((slug) => {
                const tool = tools.find((item) => item.slug === slug)
                if (!tool) return null
                return (
                  <Button key={slug} asChild variant="ghost" size="sm" flexShrink="0" fontWeight="semibold">
                    <NextLink href={`/tools/${slug}`}>{tool.title}</NextLink>
                  </Button>
                )
              })}
            </HStack>

            <Text
              display={{ base: "none", lg: "block" }}
              flexShrink="0"
              fontSize="sm"
              fontWeight="bold"
              color="fg.muted"
            >
              VUTEQ INDONESIA
            </Text>
          </Flex>

          <HStack
            as="nav"
            aria-label="Main tools mobile"
            gap="1"
            pb="3"
            overflowX="auto"
            scrollbar="hidden"
            display={{ base: "flex", md: "none" }}
          >
            {shortcuts.map((slug) => {
              const tool = tools.find((item) => item.slug === slug)
              if (!tool) return null
              return (
                <Button key={slug} asChild variant="ghost" size="xs" flexShrink="0">
                  <NextLink href={`/tools/${slug}`}>{tool.title}</NextLink>
                </Button>
              )
            })}
          </HStack>
        </Container>
      </Box>

      <Box as="main" position="relative" overflow="hidden">
        <Box
          position="absolute"
          inset="0"
          pointerEvents="none"
          bgGradient="to-br"
          gradientFrom="blue.50"
          gradientVia="transparent"
          gradientTo="red.50"
          opacity="0.7"
        />

        <Container
          position="relative"
          maxW="8xl"
          px={{ base: "4", md: "6", xl: "8" }}
          py={{ base: "5", md: "7", lg: "9" }}
        >
          <HStack
            role="group"
            aria-label="Tool categories filter"
            gap="2"
            mb={{ base: "5", md: "7" }}
            overflowX="auto"
            scrollbar="hidden"
            pb="1"
          >
            {filters.map((item) => {
              const active = filter === item.value
              return (
                <Button
                  key={item.value}
                  size={{ base: "sm", md: "md" }}
                  flexShrink="0"
                  rounded="full"
                  variant={active ? "solid" : "outline"}
                  colorPalette={active ? "gray" : "gray"}
                  bg={active ? "gray.900" : "bg.panel"}
                  color={active ? "white" : "fg.default"}
                  borderColor="border"
                  _hover={{ bg: active ? "gray.800" : "bg.muted" }}
                  aria-pressed={active}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </Button>
              )
            })}
          </HStack>

          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap={{ base: "3", md: "4" }}>
            {visibleTools.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.slug}
                  asChild
                  color="inherit"
                  textDecoration="none"
                  _hover={{ textDecoration: "none" }}
                  _focusVisible={{ outline: "none" }}
                >
                  <NextLink href={`/tools/${tool.slug}`} aria-label={`Open ${tool.title}`}>
                    <Stack
                      as="article"
                      minH={{ base: "44", md: "56" }}
                      bg="bg.panel"
                      borderWidth="1px"
                      borderColor="border"
                      rounded="2xl"
                      p={{ base: "5", md: "6" }}
                      gap="4"
                      shadow="xs"
                      cursor="pointer"
                      transition="border-color 0.2s, box-shadow 0.2s, transform 0.2s"
                      _hover={{ borderColor: `${tool.colorPalette}.400`, shadow: "md", transform: "translateY(-3px)" }}
                      _focusWithin={{ ring: "2px", ringColor: `${tool.colorPalette}.focusRing` }}
                    >
                      <Flex align="start" justify="space-between" gap="3">
                        <Flex
                          align="center"
                          justify="center"
                          boxSize={{ base: "11", md: "12" }}
                          rounded="lg"
                          bg={`${tool.colorPalette}.subtle`}
                          color={`${tool.colorPalette}.fg`}
                        >
                          <Icon size={25} strokeWidth={2.2} aria-hidden="true" />
                        </Flex>
                      </Flex>

                      <Box>
                        <Heading as="h2" size={{ base: "md", md: "lg" }} mb="2">
                          {tool.title}
                        </Heading>
                        <Text color="fg.muted" fontSize={{ base: "sm", md: "md" }} lineHeight="tall">
                          {tool.description}
                        </Text>
                      </Box>
                    </Stack>
                  </NextLink>
                </Link>
              )
            })}
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  )
}
