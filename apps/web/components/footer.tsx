import { Box, Container, Text } from "@chakra-ui/react"

export function Footer() {
  return (
    <Box
      as="footer"
      borderTopWidth="1px"
      borderColor="border.subtle"
      bg="bg.panel"
      py={{ base: "4", md: "5" }}
      mt="auto"
    >
      <Container maxW="8xl" px={{ base: "4", md: "6", xl: "8" }} textAlign="center">
        <Text
          fontSize={{ base: "xs", md: "sm" }}
          color="fg.muted"
          fontWeight="medium"
          letterSpacing="normal"
        >
          PT Vuteq Indonesia 2026 Developed By IT Department
        </Text>
      </Container>
    </Box>
  )
}
