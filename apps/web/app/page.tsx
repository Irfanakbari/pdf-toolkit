import Link from "next/link"
import { Box, Button, Container, Flex, Heading, Image, SimpleGrid, Text } from "@chakra-ui/react"
import { ArrowRight, LockKeyhole } from "lucide-react"

import { tools } from "@/lib/tools"

export default function Home() {
  return (
    <Box minH="100dvh" bg="bg.canvas">
      <Box as="header" bg="bg.panel" borderBottomWidth="1px" position="sticky" top="0" zIndex="sticky">
        <Container maxW="7xl" py={{ base: "3", md: "4" }}>
          <Flex align="center" justify="space-between" gap="4">
            <Flex align="center" gap={{ base: "3", md: "4" }} minW="0">
              <Image
                src="/brand/vuteq-logo.png"
                alt="Logo VUTEQ"
                width={{ base: "28", sm: "32", md: "36" }}
                height="auto"
                flexShrink="0"
              />
              <Box borderLeftWidth="1px" pl={{ base: "3", md: "4" }} minW="0">
                <Heading as="h1" fontSize={{ base: "sm", sm: "md", md: "lg" }} lineHeight="short" truncate>
                  VUTEQ INDONESIA
                </Heading>
                <Text color="fg.muted" fontSize={{ base: "xs", md: "sm" }}>
                  PDF Toolkit
                </Text>
              </Box>
            </Flex>
          </Flex>
        </Container>
      </Box>

      <Box as="main">
        <Container maxW="7xl" py={{ base: "5", sm: "7", md: "10" }}>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap={{ base: "3", md: "5" }}>
            {tools.map((tool) => {
              const Icon = tool.icon

              return (
                <Flex
                  as="article"
                  key={tool.slug}
                  direction="column"
                  minH={{ base: "44", md: "52" }}
                  bg="bg.panel"
                  borderWidth="1px"
                  rounded={{ base: "xl", md: "2xl" }}
                  p={{ base: "4", md: "5" }}
                  shadow="sm"
                  transition="border-color 0.2s, box-shadow 0.2s, transform 0.2s"
                  _hover={{ borderColor: "teal.400", shadow: "md", transform: "translateY(-2px)" }}
                  _focusWithin={{ borderColor: "teal.500", ring: "2px", ringColor: "teal.focusRing" }}
                >
                  <Flex align="start" justify="space-between" gap="3">
                    <Flex
                      align="center"
                      justify="center"
                      boxSize={{ base: "11", md: "12" }}
                      bg="teal.subtle"
                      color="teal.fg"
                      rounded="xl"
                    >
                      <Icon size={24} aria-hidden="true" />
                    </Flex>
                    {tool.local && (
                      <Flex align="center" gap="1" color="teal.fg">
                        <LockKeyhole size={14} aria-hidden="true" />
                        <Text fontSize="xs" fontWeight="bold">
                          LOKAL
                        </Text>
                      </Flex>
                    )}
                  </Flex>

                  <Heading as="h2" size={{ base: "md", md: "lg" }} mt="4" mb="4">
                    {tool.title}
                  </Heading>

                  <Button asChild variant="ghost" colorPalette="teal" mt="auto" justifyContent="space-between" px="0">
                    <Link href={`/tools/${tool.slug}`} aria-label={`Buka ${tool.title}`}>
                      Buka
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </Flex>
              )
            })}
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  )
}
